import { USER_REMINDER_ADD, USER_REMINDER_REMOVE, USER_REMINDER_UPDATE } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { PartialReminder } from '../services/Reminder';

export const emitReminderAdd = (userId: string, reminder: PartialReminder) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_ADD, reminder);
};
export const emitReminderUpdate = (userId: string, reminder: PartialReminder) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_UPDATE, reminder);
};
export const emitReminderRemove = (userId: string, reminderId: string) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_REMOVE, { id: reminderId });
};
