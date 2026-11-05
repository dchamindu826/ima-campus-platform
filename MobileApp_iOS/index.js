import { AppRegistry, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import App from './App';

// 🔥 1. Firebase Background Messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);

  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'General Updates',
    importance: AndroidImportance.HIGH,
  });

  const fullBody = remoteMessage.data?.body || remoteMessage.notification?.body || 'New Notification';
  const notifImageAndroid = remoteMessage.notification?.android?.imageUrl;
  const notifImageApple = remoteMessage.notification?.apple?.imageUrl;
  const dataImage = remoteMessage.data?.image_url || remoteMessage.data?.image;
  
  const notifImage = notifImageAndroid || notifImageApple || dataImage;

  let notificationConfig = {
    title: remoteMessage.data?.title || remoteMessage.notification?.title || 'IMA Campus',
    body: fullBody,
    android: {
      channelId: channelId,
      smallIcon: 'ic_launcher', // 🔥 FIX: Mekath ic_launcher karanna
      largeIcon: 'ic_launcher', 
      color: '#9B1B1B',
      pressAction: {
        id: 'default',
      },
    },
    // 🔥 FIX: iOS attachment
    ios: {
      attachments: notifImage ? [{ url: notifImage }] : [],
    }
  };

  if (notifImage && Platform.OS === 'android') {
    notificationConfig.android.largeIcon = notifImage;
    notificationConfig.android.style = {
      type: AndroidStyle.BIGPICTURE,
      picture: notifImage,
      summary: fullBody,
    };
  }

  await notifee.displayNotification(notificationConfig);
});

// 🔥 2. Local Trigger Notifications Background Handler (මේක අනිවාර්යයි Live Class Alarm එකට)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('User pressed a local notification in the background!', detail.notification);
  }
});

AppRegistry.registerComponent('main', () => App);