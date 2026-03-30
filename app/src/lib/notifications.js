import { supabase } from './supabase'

/**
 * Send an in-app notification + optional browser push.
 * All notification types are handled here for consistency.
 */
export async function sendNotification({ userId, type, title, body, data = {} }) {
  // Save to notifications table (in-app)
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data
  })
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId) {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

/**
 * Notification templates for each social action
 */
export const NotificationTemplates = {
  friendRequest: (senderName) => ({
    type: 'friend_request',
    title: 'New Friend Request',
    body: `${senderName} wants to connect with you!`
  }),

  friendAccepted: (accepterName) => ({
    type: 'friend_accepted',
    title: 'Friend Request Accepted',
    body: `${accepterName} accepted your friend request!`
  }),

  nudge: (senderName, message) => ({
    type: 'nudge',
    title: 'Training Nudge',
    body: message || `${senderName} says: Time to train!`
  }),

  trainingInvite: (senderName, sessionTitle) => ({
    type: 'invite',
    title: 'Training Invite',
    body: `${senderName} invited you to train: ${sessionTitle}`
  }),

  inviteAccepted: (accepterName, sessionTitle) => ({
    type: 'invite_accepted',
    title: 'Invite Accepted',
    body: `${accepterName} is joining: ${sessionTitle}`
  }),

  inviteDeclined: (declinerName, sessionTitle) => ({
    type: 'invite_declined',
    title: 'Invite Declined',
    body: `${declinerName} can't make it to: ${sessionTitle}`
  }),

  dailyReminder: (workoutName) => ({
    type: 'daily_reminder',
    title: 'Time to Train',
    body: workoutName 
      ? `Today's workout: ${workoutName}. Let's get it!`
      : 'You have a workout scheduled today. Don\'t skip!'
  }),

  streakWarning: (currentStreak) => ({
    type: 'streak_warning',
    title: 'Don\'t Break Your Streak!',
    body: `You're on a ${currentStreak}-day streak. Train today to keep it going!`
  }),

  newPR: (exerciseName, weight, unit) => ({
    type: 'new_pr',
    title: 'New Personal Record!',
    body: `You hit ${weight} ${unit} on ${exerciseName}!`
  }),

  sessionReminder: (sessionTitle, timeUntil) => ({
    type: 'session_reminder',
    title: 'Training Session Soon',
    body: `"${sessionTitle}" starts in ${timeUntil}. Get ready!`
  }),

  weeklyProgress: (workoutsThisWeek, volumeThisWeek) => ({
    type: 'weekly_progress',
    title: 'Weekly Recap',
    body: `This week: ${workoutsThisWeek} workouts, ${volumeThisWeek} total volume. Keep pushing!`
  })
}
