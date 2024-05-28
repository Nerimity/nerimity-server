import { Router } from 'express';
import { login } from './login';
import { register } from './register';
import { userDetails } from './userDetails';
import { userFollow } from './userFollow';
import { userFollowers } from './userFollowers';
import { userFollowing } from './userFollowing';
import { userOpenDMChannel } from './userOpenDMChannel';
import { userUnfollow } from './userUnfollow';
import { userUpdate } from './userUpdate';
import { userUpdatePresence } from './userUpdatePresence';
import { userUpdateNotificationSettings } from './userUpdateNotificationSettings';
import { userRegisterFCM } from './userRegisterFCM';
import { userDeleteAccount } from './userDeleteAccount';
import { userBlock } from './userBlock';
import { userUnblock } from './userUnblock';
import { userNotifications } from './userNotifications';
import { userEmailConfirmCodeSend } from './userEmailConfirmCodeSend';
import { userEmailConfirmCode } from './userEmailConfirmCode';
import { userChannelNoticeDelete } from './userChannelNoticeDelete';
import { userChannelNoticeGet } from './userChannelNoticeGet';
import { userChannelNoticeUpdate } from './userChannelNoticeUpdate';
import { userDismissNotice } from './userDismissNotice';
import { userPasswordResetCodeSent } from './userPasswordResetCodeSend';
import { userPasswordReset } from './userPasswordReset';

const UsersRouter = Router();

userDismissNotice(UsersRouter);

userChannelNoticeGet(UsersRouter);
userChannelNoticeDelete(UsersRouter);
userChannelNoticeUpdate(UsersRouter);

userPasswordResetCodeSent(UsersRouter);
userPasswordReset(UsersRouter);

userEmailConfirmCode(UsersRouter);
userEmailConfirmCodeSend(UsersRouter);

register(UsersRouter);
login(UsersRouter);
userUpdate(UsersRouter);

userBlock(UsersRouter);
userUnblock(UsersRouter);

userRegisterFCM(UsersRouter);
userOpenDMChannel(UsersRouter);
userUpdatePresence(UsersRouter);
userDeleteAccount(UsersRouter);

userNotifications(UsersRouter);
userDetails(UsersRouter);

userFollow(UsersRouter);
userUnfollow(UsersRouter);
userFollowers(UsersRouter);
userFollowing(UsersRouter);
userUpdateNotificationSettings(UsersRouter);

export { UsersRouter };
