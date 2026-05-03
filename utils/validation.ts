import { z } from 'zod';

// Auth Schemas
export const RegisterSchema = z.object({
  username: z.string().min(3).max(30).toLowerCase(),
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(50),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Chat Schemas
export const CreateChatSchema = z.object({
  participantIds: z.array(z.string()).min(1),
  isGroup: z.boolean().optional().default(false),
  name: z.string().max(100).optional(),
  description: z.string().max(200).optional(),
  groupIcon: z.string().optional(),
});

export const UpdateChatSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(200).optional(),
  groupIcon: z.string().optional(),
});

export const MarkChatReadSchema = z.object({
  chatId: z.string(),
});

// Message Schemas
export const SendMessageSchema = z.object({
  chatId: z.string(),
  content: z.string().max(5000).optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
  replyTo: z.string().optional(),
  tempId: z.string(),
  media: z.object({
    url: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
    thumbnail: z.string().optional(),
    duration: z.number().optional(),
  }).optional(),
});

export const MarkMessageReadSchema = z.object({
  chatId: z.string(),
  messageIds: z.array(z.string()),
});

export const EditMessageSchema = z.object({
  content: z.string().max(5000),
});

export const DeleteMessageSchema = z.object({
  messageId: z.string(),
  deleteForEveryone: z.boolean().optional().default(false),
});

// Group Management Schemas
export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  memberIds: z.array(z.string()).min(2),
  groupIcon: z.string().optional(),
  description: z.string().max(200).optional(),
});

export const AddGroupMemberSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});

export const RemoveGroupMemberSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});

export const UpdateGroupSchema = z.object({
  chatId: z.string(),
  name: z.string().max(100).optional(),
  description: z.string().max(200).optional(),
  groupIcon: z.string().optional(),
});

// Socket Event Schemas
export const SocketMessageSendSchema = z.object({
  chatId: z.string(),
  content: z.string().max(5000).optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
  replyTo: z.string().optional(),
  tempId: z.string(),
});

export const SocketMessageReadSchema = z.object({
  chatId: z.string(),
  messageIds: z.array(z.string()),
});

export const SocketTypingSchema = z.object({
  chatId: z.string(),
});

export const SocketChatJoinSchema = z.object({
  chatId: z.string(),
});

export const SocketChatLeaveSchema = z.object({
  chatId: z.string(),
});

export const SocketGroupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  memberIds: z.array(z.string()).min(2),
  groupIcon: z.string().optional(),
  description: z.string().max(200).optional(),
});

export const SocketGroupAddMemberSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});

export const SocketGroupRemoveMemberSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
});

export const SocketGroupLeaveSchema = z.object({
  chatId: z.string(),
});

export const SocketGroupUpdateSchema = z.object({
  chatId: z.string(),
  name: z.string().max(100).optional(),
  description: z.string().max(200).optional(),
  groupIcon: z.string().optional(),
});
