import api from './api';

export interface OnboardResponse {
  success: boolean;
  jwt?: string;
  expiresIn?: number;
  expiresAt?: string;
  broker?: string;
  user?: { id: string; name: string; email: string };
  message?: string;
}

export interface UserDetail {
  _id: string;
  name: string;
  email: string;
  picture: string;
  broker?: string;
}

export async function onboard(apiKey: string): Promise<OnboardResponse> {
  const res = await api.post('/api/v1/users/onboard', { apiKey });
  return res.data;
}

export async function getUserDetail(email: string): Promise<UserDetail> {
  const res = await api.get('/api/v1/users/detail', { params: { email } });
  return res.data?.user;
}

export async function refreshJwt(): Promise<{ jwt: string }> {
  const token = localStorage.getItem('mintzy_token');
  const res = await api.post('/api/v1/users/refresh', {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export interface EgressAssignment {
  broker: string;
  static_ip: string;
  client_code: string | null;
  /** assigned: register it with your broker; active: orders from it have been verified. */
  status: 'assigned' | 'active';
  assigned_at: string | null;
  updated_at: string | null;
}

/** Static IPs Mintzy assigned to the signed-in user's broker accounts. Empty: none yet. */
export async function getMyEgress(): Promise<EgressAssignment[]> {
  const res = await api.get('/api/v1/users/me/egress');
  return Array.isArray(res.data?.assignments) ? res.data.assignments : [];
}
