import { Response } from 'express';

// Each authenticated user can have several tabs open.
const clients = new Map<string, Set<Response>>();

export function isMessagingOnline(userId: string): boolean {
  return Boolean(clients.get(userId)?.size);
}

export function subscribeToMessages(userId: string, response: Response): () => void {
  const connections = clients.get(userId) || new Set<Response>();
  connections.add(response);
  clients.set(userId, connections);
  return () => {
    connections.delete(response);
    if (!connections.size) clients.delete(userId);
  };
}

export function publishMessagingEvent(userIds: string[], event: object): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of new Set(userIds)) {
    for (const response of clients.get(userId) || []) {
      if (!response.destroyed && !response.writableEnded) response.write(data);
    }
  }
}
