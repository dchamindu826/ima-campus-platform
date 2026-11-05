import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import COLORS from '../constants/colors';
import downloadManager from '../services/downloadManager';

const GlobalDownloadWidget = () => {
    const [downloads, setDownloads] = useState({});
    const [slideAnim] = useState(new Animated.Value(100)); // Initial position off-screen

    useEffect(() => {
        // Load initial state
        const initialDownloads = downloadManager.getActiveDownloads();
        setDownloads({ ...initialDownloads });

        const onProgress = (data) => {
            setDownloads(prev => ({ ...prev, [data.itemId]: data }));
        };

        const onComplete = (data) => {
            setDownloads(prev => {
                const newDownloads = { ...prev };
                delete newDownloads[data.itemId];
                return newDownloads;
            });
        };

        const onError = (data) => {
            setDownloads(prev => {
                const newDownloads = { ...prev };
                delete newDownloads[data.itemId];
                return newDownloads;
            });
        };

        const progressSub = DeviceEventEmitter.addListener('DOWNLOAD_PROGRESS', onProgress);
        const completeSub = DeviceEventEmitter.addListener('DOWNLOAD_COMPLETE', onComplete);
        const errorSub = DeviceEventEmitter.addListener('DOWNLOAD_ERROR', onError);

        return () => {
            progressSub.remove();
            completeSub.remove();
            errorSub.remove();
        };
    }, []);

    const hasDownloads = Object.keys(downloads).length > 0;

    useEffect(() => {
        if (hasDownloads) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 100,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [hasDownloads, slideAnim]);

    if (!hasDownloads) return null;

    // Show only the latest/first download or aggregate them
    const activeItems = Object.values(downloads);
    const firstItem = activeItems[0];
    const moreCount = activeItems.length - 1;

    let progressPercentage = 0;
    let progressText = '';
    if (firstItem.progress === '...') {
        progressText = 'Extracting...';
    } else {
        progressPercentage = typeof firstItem.progress === 'number' ? firstItem.progress : 0;
        progressText = `${progressPercentage}%`;
    }

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.content}>
                <View style={styles.iconBox}>
                    <Icon name="cloud-download-outline" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        Downloading: {firstItem.title}
                    </Text>
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
                        </View>
                        <Text style={styles.subtitle}>
                            {progressText} {moreCount > 0 ? ` (+${moreCount})` : ''}
                        </Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        color: '#1F2937',
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 6,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    subtitle: {
        color: '#6B7280',
        fontSize: 12,
        fontWeight: '700',
        minWidth: 40,
        textAlign: 'right',
    }
});

export default GlobalDownloadWidget;
