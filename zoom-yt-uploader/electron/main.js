const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { google } = require('googleapis');
const http = require('http');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f172a'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5180');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Settings & History Management
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const historyPath = path.join(app.getPath('userData'), 'history.json');

ipcMain.handle('get-history', async () => {
  if (fs.existsSync(historyPath)) {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  return [];
});

ipcMain.handle('save-history', async (event, historyItem) => {
  let history = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  history.unshift(historyItem); // add to top
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  return history;
});

ipcMain.handle('rename-history', async (event, { id, newTitle }) => {
  let history = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  const idx = history.findIndex(h => h.id === id);
  if (idx !== -1) {
    history[idx].title = newTitle;
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }
  return history;
});

ipcMain.handle('get-settings', async () => {
  if (fs.existsSync(settingsPath)) {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  return {};
});

ipcMain.handle('save-settings', async (event, settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return true;
});

// Google OAuth Setup
ipcMain.handle('auth-google', async (event) => {
  const settings = JSON.parse(fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}');
  
  if (!settings.youtubeClientId || !settings.youtubeClientSecret) {
    throw new Error('Please save your Google Client ID and Secret in settings first.');
  }

  const oauth2Client = new google.auth.OAuth2(
    settings.youtubeClientId,
    settings.youtubeClientSecret,
    'http://localhost:3000/oauth2callback'
  );

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          const qs = new URL(req.url, 'http://localhost:3000').searchParams;
          res.end('Authentication successful! Please return to the app. You can close this window now.');
          server.destroy();
          
          const { tokens } = await oauth2Client.getToken(qs.get('code'));
          oauth2Client.setCredentials(tokens);
          
          // Fetch channel details
          const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
          const channelRes = await youtube.channels.list({
            part: 'snippet',
            mine: true
          });
          
          let channelInfo = { id: 'Unknown', title: 'Unknown Channel', thumbnail: '' };
          if (channelRes.data.items && channelRes.data.items.length > 0) {
            const snippet = channelRes.data.items[0].snippet;
            channelInfo = {
              id: channelRes.data.items[0].id,
              title: snippet.title,
              thumbnail: snippet.thumbnails?.default?.url || snippet.thumbnails?.high?.url || ''
            };
          }

          if (!settings.youtubeAccounts) settings.youtubeAccounts = [];
          
          // Check if already exists
          const existingIdx = settings.youtubeAccounts.findIndex(acc => acc.id === channelInfo.id);
          const accountData = { ...channelInfo, tokens };
          
          if (existingIdx >= 0) {
            settings.youtubeAccounts[existingIdx] = accountData;
          } else {
            settings.youtubeAccounts.push(accountData);
          }

          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          resolve(settings.youtubeAccounts);
        }
      } catch (e) {
        reject(e);
      }
    });
    
    import('server-destroy').then(({default: enableDestroy}) => {
      enableDestroy(server);
      server.listen(3000, () => {
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly'
          ]
        });
        shell.openExternal(authUrl);
      });
    }).catch(reject);
  });
});

ipcMain.handle('remove-youtube-account', async (event, accountId) => {
  const settings = JSON.parse(fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}');
  if (settings.youtubeAccounts) {
    settings.youtubeAccounts = settings.youtubeAccounts.filter(acc => acc.id !== accountId);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
  return settings.youtubeAccounts || [];
});

ipcMain.handle('check-youtube-auth', async () => {
  const settings = JSON.parse(fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}');
  return settings.youtubeAccounts && settings.youtubeAccounts.length > 0;
});

// Helper for Zoom OAuth
async function getZoomToken(accountId, clientId, clientSecret) {
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await axios.post(tokenUrl, {}, {
    headers: { 'Authorization': authHeader }
  });
  return response.data.access_token;
}

const ZOOM_ACCOUNTS = [
  { name: "Acc 01", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "Lzn79CR2W2LLKVAm9thw", clientSecret: "cs0qQYhl3HVKRh9liOmA8SNz3217njHY" },
  { name: "Acc 02", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "zdp67ASFQ8yp4Y6YXBB20Q", clientSecret: "YAA1RWgc9pEq7QMhKYc2xhYITNkcDQ3K" },
  { name: "Acc 03", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "NY0LYloxTZGhwi2l0pcpTQ", clientSecret: "A898Z1ZJsebK6uY3Pf5TRbxgo0JPpOSv" },
  { name: "Acc 04", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "iU2c7XYURSyY_yIySVEuVg", clientSecret: "KXHh0mXb0KMJ5PqCN4n7OBbEnhXCTQ08" },
  { name: "Acc 05", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "gKXNiK2jT42W2pkP11ncAg", clientSecret: "PtVybT7aA4wNQELTJMhL63awUOFv9dpn" },
  { name: "Acc 06", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "jheRyAaOQ0ugGeWjoYvQFQ", clientSecret: "GuYPH13R0eJnkqkWRZX8nAC1iC8IWp8z" },
  { name: "Acc 07", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "I1ko4YsDTUCpGrcobIfFrA", clientSecret: "NKKghbWe5t2PX95Dov3xpq1G58lvkEj7" },
  { name: "Acc 08", accountId: "nsKzuoSbQLqeEKFO25W3QA", clientId: "Cv5XlndDTVKNY6v_pYg37g", clientSecret: "H1TNcXkr4SENQ3236jFIyzAnctA19dYZ" }
];

// Zoom Instances Fetcher
ipcMain.handle('fetch-zoom-instances', async (event, inputId) => {
  // Extract Meeting ID from potential Zoom URLs (e.g. https://zoom.us/rec/share/...) or just clean it
  let meetingId = inputId.replace(/[-\s]+/g, '');
  const urlMatch = meetingId.match(/(?:zoom\.us\/.*?\/)([a-zA-Z0-9_-]+)/);
  if (urlMatch && !meetingId.match(/^\d+$/)) {
      meetingId = meetingId.match(/\d{9,11}/)?.[0] || meetingId;
  } else {
      meetingId = meetingId.match(/\d{9,11}/)?.[0] || meetingId;
  }
  
  const cleanMeetingId = meetingId;
  let allInstances = [];

  for (const acc of ZOOM_ACCOUNTS) {
    try {
      const token = await getZoomToken(acc.accountId, acc.clientId, acc.clientSecret);
      const res = await axios.get(`https://api.zoom.us/v2/past_meetings/${cleanMeetingId}/instances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data && res.data.meetings) {
        // Tag with the account so we know which one has it
        const meetingsWithAcc = res.data.meetings.map(m => ({ ...m, accountName: acc.name, token }));
        allInstances = allInstances.concat(meetingsWithAcc);
      }
    } catch (e) {
      // Ignored, might not exist in this account
    }
  }

  // Deduplicate by UUID
  const unique = [];
  const uuids = new Set();
  for (const inst of allInstances) {
    if (!uuids.has(inst.uuid)) {
      uuids.add(inst.uuid);
      unique.push(inst);
    }
  }

  // FALLBACK: If Zoom S2S apps are missing the 'meeting:read:list_past_instances' scope, unique will be empty.
  // We can still try to get the latest recording directly!
  if (unique.length === 0) {
    for (const acc of ZOOM_ACCOUNTS) {
      try {
        const token = await getZoomToken(acc.accountId, acc.clientId, acc.clientSecret);
        if (!token) continue;
        
        const recRes = await axios.get(`https://api.zoom.us/v2/meetings/${cleanMeetingId}/recordings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (recRes.data && recRes.data.uuid) {
           unique.push({
              uuid: recRes.data.uuid,
              start_time: recRes.data.start_time || new Date().toISOString(),
              token: token,
              accountName: acc.name
           });
           break; // Found it in one account, no need to check others
        }
      } catch (e) {
        // Ignored
      }
    }
  }

  // Fetch actual recordings for each instance
  const detailedInstances = [];
  for (const inst of unique) {
    try {
      const encodedUuid = encodeURIComponent(encodeURIComponent(inst.uuid));
      const recRes = await axios.get(`https://api.zoom.us/v2/meetings/${encodedUuid}/recordings`, {
        headers: { 'Authorization': `Bearer ${inst.token}` }
      });
      
      const recordingFiles = recRes.data.recording_files || [];
      const mp4 = recordingFiles.find(f => f.file_type === 'MP4');
      if (mp4) {
        // Don't send the token to the frontend
        delete inst.token;
        inst.topic = recRes.data.topic || 'Zoom Class Recording';
        inst.duration = recRes.data.duration || 0; // minutes
        inst.total_size = mp4.file_size || 0; // bytes
        inst.share_url = recRes.data.share_url || '';
        detailedInstances.push(inst);
      }
    } catch(e) {
      // no recording found for this instance
    }
  }

  return detailedInstances.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
});
let currentUploadCancel = null;

ipcMain.handle('cancel-upload', async () => {
  if (currentUploadCancel) {
    currentUploadCancel();
    currentUploadCancel = null;
    return true;
  }
  return false;
});

// Main Process
ipcMain.handle('start-upload-process', async (event, data) => {
  const { meetingId: inputId, uuid, youtubeAccountId, thumbnailPath, category } = data;
  const settings = JSON.parse(fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : '{}');
  
  let meetingId = inputId.replace(/[-\s]+/g, '');
  meetingId = meetingId.match(/\d{9,11}/)?.[0] || meetingId;
  const cleanMeetingId = meetingId;
  const tempFilePath = path.join(app.getPath('temp'), `zoom_${cleanMeetingId}.mp4`);
  
  const ytAccount = (settings.youtubeAccounts || []).find(acc => acc.id === youtubeAccountId);
  if (!ytAccount) throw new Error('Selected YouTube account is not authenticated.');

  try {
    let isCancelled = false;
    currentUploadCancel = () => { isCancelled = true; };

    event.sender.send('upload-progress', { stage: 'Searching Zoom Recording...', percent: 5 });
    
    let meetingRes = null;
    let zoomToken = null;
    let mp4File = null;

    // Zoom requires UUIDs containing '/' to be double URL encoded
    const encodedUuid = uuid ? encodeURIComponent(encodeURIComponent(uuid)) : null;
    const searchTarget = encodedUuid || cleanMeetingId;

    for (const acc of ZOOM_ACCOUNTS) {
      if (isCancelled) throw new Error('Transfer cancelled by user');
      try {
        const token = await getZoomToken(acc.accountId, acc.clientId, acc.clientSecret);
        const res = await axios.get(`https://api.zoom.us/v2/meetings/${searchTarget}/recordings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const recordingFiles = res.data.recording_files || [];
        const mp4 = recordingFiles.find(f => f.file_type === 'MP4');
        
        if (mp4) {
          meetingRes = res;
          zoomToken = token;
          mp4File = mp4;
          event.sender.send('upload-progress', { stage: `Found recording in ${acc.name}!`, percent: 15 });
          break; // Stop searching once found
        }
      } catch (e) {
        // Ignored, try next account
      }
    }

    if (!mp4File) {
      throw new Error('No MP4 recording found for this Meeting ID in any Zoom account.');
    }

    if (isCancelled) throw new Error('Transfer cancelled by user');

    // 3. Download MP4
    event.sender.send('upload-progress', { stage: 'Downloading Video...', percent: 30 });
    const downloadUrl = `${mp4File.download_url}?access_token=${zoomToken}`;
    
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();

    currentUploadCancel = () => {
      isCancelled = true;
      source.cancel('Transfer cancelled by user');
    };

    const writer = fs.createWriteStream(tempFilePath);
    const downloadRes = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      cancelToken: source.token
    });

    const totalLength = downloadRes.headers['content-length'];
    let downloaded = 0;
    
    currentUploadCancel = () => {
      isCancelled = true;
      source.cancel('Transfer cancelled by user');
      downloadRes.data.destroy(); // Destroy the stream to abort piping
    };

    downloadRes.data.on('data', (chunk) => {
      downloaded += chunk.length;
      const percent = Math.floor((downloaded / totalLength) * 30) + 30; // 30% to 60%
      event.sender.send('upload-progress', { stage: `Downloading Video (${(downloaded/1024/1024).toFixed(1)}MB)`, percent });
    });

    downloadRes.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      downloadRes.data.on('error', reject);
    });

    if (isCancelled) throw new Error('Transfer cancelled by user');

    // 4. Upload to YouTube
    event.sender.send('upload-progress', { stage: 'Uploading to YouTube...', percent: 65 });
    
    const oauth2Client = new google.auth.OAuth2(
      settings.youtubeClientId,
      settings.youtubeClientSecret,
      'http://localhost:3000/oauth2callback'
    );
    oauth2Client.setCredentials(ytAccount.tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const fileSize = fs.statSync(tempFilePath).size;
    const ytStream = fs.createReadStream(tempFilePath);
    
    currentUploadCancel = () => {
      isCancelled = true;
      ytStream.destroy(new Error('Transfer cancelled by user'));
    };

    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: meetingRes.data.topic || `Zoom Class Recording`,
          description: `Class recorded on ${new Date(meetingRes.data.start_time).toLocaleString()}`
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: ytStream
      }
    }, {
      onUploadProgress: evt => {
        if (isCancelled) return;
        const percent = Math.floor((evt.bytesRead / fileSize) * 30) + 65; // 65% to 95%
        event.sender.send('upload-progress', { stage: `Uploading to YouTube (${(evt.bytesRead/1024/1024).toFixed(1)}MB)`, percent });
      }
    });

    if (isCancelled) throw new Error('Transfer cancelled by user');

    const videoId = res.data.id;

    // 5. Upload Custom Thumbnail
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      event.sender.send('upload-progress', { stage: 'Setting Custom Thumbnail...', percent: 96 });
      try {
        // Delay slightly to ensure YT has registered the video fully
        await new Promise(r => setTimeout(r, 2000));
        if (!isCancelled) {
          await youtube.thumbnails.set({
            videoId: videoId,
            media: {
              body: fs.createReadStream(thumbnailPath)
            }
          });
        }
      } catch (thumbErr) {
        console.error('Thumbnail error:', thumbErr);
        // Continue even if thumbnail fails, video is already uploaded
      }
    }

    // Cleanup
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    
    const youtubeUrl = `https://youtu.be/${videoId}`;
    const videoTitle = meetingRes.data.topic || `Zoom Class Recording`;

    // Save to History
    let history = [];
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
    history.unshift({
      id: videoId,
      title: videoTitle,
      youtubeUrl,
      category: category || 'Uncategorized',
      date: new Date().toISOString(),
      thumbnailPath: thumbnailPath || '',
      channelId: ytAccount.id,
      channelName: ytAccount.title
    });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    event.sender.send('upload-progress', { stage: 'Completed', percent: 100 });
    return { success: true, youtubeUrl };

  } catch (error) {
    console.error(error);
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error occurred';
    
    // Cleanup temporary file if it exists and we failed
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {}

    throw new Error(errorMsg);
  } finally {
    currentUploadCancel = null;
  }
});
