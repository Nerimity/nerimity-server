import { postJson, type ApiError } from './apiClient';

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
};

type RegisterResponse = {
  token: string;
} | ApiError;

export const registerUser = (payload: RegisterPayload) =>
  postJson<RegisterResponse>('/users/register', payload);
