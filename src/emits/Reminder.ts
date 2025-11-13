import { USER_REMINDER_ADD, USER_REMINDER_REMOVE, USER_REMINDER_UPDATE } from '../common/ClientEventNames';
import { getIO } from '../socket/socket';
import { PartialReminder, TransformedReminder } from '../services/Reminder';

export const emitReminderAdd = (userId: string, reminder: TransformedReminder) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_ADD, reminder);
};
export const emitReminderUpdate = (userId: string, reminder: TransformedReminder) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_UPDATE, reminder);
};
export const emitReminderRemove = (userId: string, reminderId: string) => {
  const io = getIO();
  io.in(userId).emit(USER_REMINDER_REMOVE, { id: reminderId });
};
