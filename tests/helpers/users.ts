import { postJson, type ApiError } from './apiClient';

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
};

type RegisterResponse = {
  token: string;
}

export const registerUser = (payload: RegisterPayload) =>
  postJson<RegisterResponse>('/users/register', {body: payload});

export const sendEmailConfirmCode = (token: string) =>
  postJson<{message: string}>('/users/emails/verify/send-code', {token: token});

export const emailConfirmCode = (code: string, token: string) =>
  postJson<{status: boolean}>('/users/emails/verify', {token: token, query: {code}});
