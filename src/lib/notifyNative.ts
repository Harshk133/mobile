/**
 * Safe access to expo-notifications' local-notification functions.
 *
 * The package's main entry (`expo-notifications`) loads every feature at startup, including
 * push-topic subscription, whose native module (ExpoTopicSubscriptionModule) is missing from
 * Expo Go on Android. Importing it there crashes the whole app before anything renders.
 *
 * So the app never imports the package root at runtime. It loads only the local-notification
 * pieces it uses, on first need and inside try/catch. If any native part is missing, `native()`
 * returns null and reminders are reported as unavailable instead of crashing.
 */
import type * as N from 'expo-notifications';
import { Platform } from 'react-native';

export type Native = {
  schedule: typeof N.scheduleNotificationAsync;
  cancel: typeof N.cancelScheduledNotificationAsync;
  getAllScheduled: typeof N.getAllScheduledNotificationsAsync;
  setHandler: typeof N.setNotificationHandler;
  setChannel: typeof N.setNotificationChannelAsync;
  getPermissions: typeof N.getPermissionsAsync;
  requestPermissions: typeof N.requestPermissionsAsync;
  onResponse: typeof N.addNotificationResponseReceivedListener;
  lastResponse: typeof N.getLastNotificationResponseAsync;
  clearLastResponse: typeof N.clearLastNotificationResponseAsync;
  Trigger: typeof N.SchedulableTriggerInputTypes;
  Importance: typeof N.AndroidImportance;
};

let cached: Native | null | undefined;
let failure: string | null = null;

export function native(): Native | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    failure = 'web';
    return (cached = null);
  }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const scheduler = require('expo-notifications/build/scheduleNotificationAsync');
    const cancel = require('expo-notifications/build/cancelScheduledNotificationAsync');
    const getAll = require('expo-notifications/build/getAllScheduledNotificationsAsync');
    const handler = require('expo-notifications/build/NotificationsHandler');
    const channel = require('expo-notifications/build/setNotificationChannelAsync');
    const perms = require('expo-notifications/build/NotificationPermissions');
    const emitter = require('expo-notifications/build/NotificationsEmitter');
    const types = require('expo-notifications/build/Notifications.types');
    const chTypes = require('expo-notifications/build/NotificationChannelManager.types');
    /* eslint-enable @typescript-eslint/no-require-imports */
    cached = {
      schedule: scheduler.default ?? scheduler.scheduleNotificationAsync,
      cancel: cancel.default ?? cancel.cancelScheduledNotificationAsync,
      getAllScheduled: getAll.default ?? getAll.getAllScheduledNotificationsAsync,
      setHandler: handler.setNotificationHandler,
      setChannel: channel.default ?? channel.setNotificationChannelAsync,
      getPermissions: perms.getPermissionsAsync,
      requestPermissions: perms.requestPermissionsAsync,
      onResponse: emitter.addNotificationResponseReceivedListener,
      lastResponse: emitter.getLastNotificationResponseAsync,
      clearLastResponse: emitter.clearLastNotificationResponseAsync,
      Trigger: types.SchedulableTriggerInputTypes,
      Importance: chTypes.AndroidImportance,
    };
    if (Object.values(cached).some((v) => v === undefined)) throw new Error('expo-notifications API changed');
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    cached = null;
  }
  return cached;
}

/** Why reminders are unavailable, for the settings screen ('web' in the browser preview). */
export const nativeFailure = () => (native(), failure);
