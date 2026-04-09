import { postJson, type ApiError } from './apiClient';

type CreateMessagePayload = {
  content: string
  test_enable_rate_limit?: boolean
  test_enable_rate_limit_restrict_ms?: number
};

type CreateMessageResponse = {
  id: string;
  content: string;
}

export const createChannelMessage = (channelId: String, payload: CreateMessagePayload, token: string) =>
  postJson<CreateMessageResponse>(`/channels/${channelId}/messages`, {body: payload, token});


