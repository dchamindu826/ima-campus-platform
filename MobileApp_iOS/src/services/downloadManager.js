import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { DeviceEventEmitter, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import notifee, { AndroidImportance } from '@notifee/react-native';

const secureStoragePath = Platform.OS === 'ios' ? RNFS.LibraryDirectoryPath : RNFS.DocumentDirectoryPath;

class DownloadManager {
    constructor() {
        this.activeDownloads = {};
    }

    async init() {
        if (!(await RNFS.exists(secureStoragePath))) {
            await RNFS.mkdir(secureStoragePath);
        }
        
        if (Platform.OS === 'android') {
            await notifee.requestPermission();
            await notifee.createChannel({
                id: 'download_channel',
                name: 'Downloads',
                importance: AndroidImportance.LOW,
            });
        }
    }

    getActiveDownloads() {
        return this.activeDownloads;
    }

    async showNotification(itemId, title, body, progress = null) {
        if (Platform.OS !== 'android') return;
        
        const androidConfig = {
            channelId: 'download_channel',
            onlyAlertOnce: true,
            smallIcon: 'ic_launcher', // assuming default icon
        };

        if (progress !== null && typeof progress === 'number') {
            androidConfig.progress = {
                max: 100,
                current: progress,
            };
        }

        await notifee.displayNotification({
            id: String(itemId),
            title: title,
            body: body,
            android: androidConfig,
        });
    }

    emitProgress(itemId, progress, title) {
        const lastProgress = this.activeDownloads[itemId]?.progress;
        
        // Only emit and show notification if progress has actually changed to prevent spam
        if (lastProgress !== progress) {
            this.activeDownloads[itemId] = { progress, title };
            DeviceEventEmitter.emit('DOWNLOAD_PROGRESS', { itemId, progress, title });
            
            if (typeof progress === 'number') {
                this.showNotification(itemId, 'Downloading ' + title, 'Progress: ' + progress + '%', progress);
            } else {
                this.showNotification(itemId, 'Downloading ' + title, 'Starting...', null);
            }
        }
    }

    emitComplete(itemId, title) {
        delete this.activeDownloads[itemId];
        DeviceEventEmitter.emit('DOWNLOAD_COMPLETE', { itemId, title });
        this.showNotification(itemId, 'Download Complete', title, null);
    }

    emitError(itemId, title, errorMsg) {
        delete this.activeDownloads[itemId];
        DeviceEventEmitter.emit('DOWNLOAD_ERROR', { itemId, title, errorMsg });
        this.showNotification(itemId, 'Download Failed', title, null);
    }

    async startDownload(item, courseTitle) {
        if (!item || !item.id) return;

        if (Platform.OS === 'android') {
            try {
                await notifee.requestPermission();
                await notifee.createChannel({
                    id: 'download_channel',
                    name: 'Downloads',
                    importance: AndroidImportance.LOW,
                });
            } catch (e) {
                console.log("Notifee init error", e);
            }
        }

        let videoUrl = item.link || item.url || item.file;
        if (!videoUrl) {
            this.emitError(item.id, item.title, "Invalid video link.");
            return;
        }

        const securePath = `${secureStoragePath}/f_${item.id}.mp4`;
        const itemTitle = item.title || item.fileName || 'Video Lesson';

        try {
            const res = await AsyncStorage.getItem('my_downloads');
            const existingDownloads = res ? JSON.parse(res) : [];
            const isDownloaded = existingDownloads.find(d => String(d.id) === String(item.id));

            if (isDownloaded) {
                DeviceEventEmitter.emit('DOWNLOAD_ALREADY_EXISTS', { itemId: item.id, title: itemTitle });
                return;
            } else {
                if (await RNFS.exists(securePath)) {
                    await RNFS.unlink(securePath);
                }
            }
        } catch (e) {
            console.log("Error checking existing downloads:", e);
        }

        this.emitProgress(item.id, 0, itemTitle);

        try {
            let finalUrl = videoUrl;
            let finalHeaders = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
            };

            const token = await AsyncStorage.getItem('userToken');

            if (videoUrl.includes('zoom.us/rec/share') || videoUrl.includes('zoom.us/rec/play')) {
                this.emitProgress(item.id, '...', itemTitle);

                const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

                const res1 = await fetch(videoUrl, { headers: { 'User-Agent': ua } });
                const html1 = await res1.text();

                const mIdMatch = html1.match(/meetingId:\s*'([^']+)'/);
                if (!mIdMatch) throw new Error("Could not find meetingId in Zoom page.");
                const meetingId = mIdMatch[1];

                const res2 = await fetch(`https://zoom.us/nws/recording/1.0/play/share-info/${meetingId}`, {
                    headers: { 'User-Agent': ua, 'Referer': videoUrl }
                });
                const json2 = await res2.json();
                if (!json2.result || !json2.result.redirectUrl) throw new Error("Failed to get redirect URL from Zoom API.");
                const redirectUrl = json2.result.redirectUrl;

                const res3 = await fetch(`https://zoom.us${redirectUrl}`, {
                    headers: { 'User-Agent': ua, 'Referer': videoUrl }
                });
                const html3 = await res3.text();

                const fIdMatch = html3.match(/fileId:\s*'([^']+)'/);
                if (!fIdMatch) throw new Error("Could not find fileId in Zoom redirect page.");
                const fileId = fIdMatch[1];

                const res4 = await fetch(`https://zoom.us/nws/recording/1.0/play/info/${fileId}?continueMode=true`, {
                    headers: { 'User-Agent': ua, 'Referer': `https://zoom.us${redirectUrl}` }
                });
                const json4 = await res4.json();
                if (!json4.result || !json4.result.viewMp4Url) throw new Error("Failed to extract final MP4 URL.");

                finalUrl = json4.result.viewMp4Url;
                finalHeaders = {
                    'User-Agent': ua,
                    'Referer': `https://zoom.us${redirectUrl}`
                };
            } else if (!videoUrl.includes('cloudfront.net') && !videoUrl.includes('awssdk.com')) {
                finalHeaders['Authorization'] = `Bearer ${token}`;
            }

            let downloadConfig = {
                path: securePath,
                fileCache: true,
                overwrite: true,
                followRedirect: true,
            };

            if (Platform.OS === 'ios') {
                downloadConfig.IOSBackgroundTask = true;
                downloadConfig.timeout = 3600000;
            }

            this.emitProgress(item.id, 0, itemTitle);

            const response = await ReactNativeBlobUtil.config(downloadConfig)
                .fetch('GET', finalUrl, finalHeaders)
                .progress((received, total) => {
                    if (total > 0) {
                        let percentage = Math.floor((received / total) * 100);
                        this.emitProgress(item.id, percentage, itemTitle);
                    } else {
                        this.emitProgress(item.id, '...', itemTitle);
                    }
                });

            let status = response.info().status;
            if (status >= 400) {
                throw new Error("Server rejected the download.");
            }

            const myDownloads = await AsyncStorage.getItem('my_downloads');
            let downloads = myDownloads ? JSON.parse(myDownloads) : [];

            const itemToSave = {
                id: item.id,
                title: itemTitle,
                subjectName: item.subjectName || courseTitle || 'Subject',
                type: item.link ? 'video' : 'document',
                downloadedAt: new Date().toISOString(),
                fileName: `f_${item.id}.mp4`,
                thumbnail: item.thumbnail
            };

            downloads.push(itemToSave);
            await AsyncStorage.setItem('my_downloads', JSON.stringify(downloads));

            this.emitComplete(item.id, itemTitle);

        } catch (error) {
            console.log(error);
            this.emitError(item.id, itemTitle, error.message || "Failed to download.");
            if (await RNFS.exists(securePath)) await RNFS.unlink(securePath);
        }
    }
}

const downloadManager = new DownloadManager();
export default downloadManager;
