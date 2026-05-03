import mongoose from 'mongoose';
import { getEnvConfig } from '../utils/env.ts';
import User from '../models/User.ts';
import Chat from '../models/Chat.ts';
import Message from '../models/Message.ts';

const config = getEnvConfig();

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.MONGODB_URI, {
      retryWrites: true,
      w: 'majority',
    });

    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Chat.deleteMany({});
    await Message.deleteMany({});

    console.log('Creating sample users...');
    const users = await User.create([
      {
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        displayName: 'Alice Johnson',
        about: 'Hey there! I am Alice',
        isOnline: true,
      },
      {
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
        displayName: 'Bob Smith',
        about: 'Hi, I am Bob',
        isOnline: false,
      },
      {
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'password123',
        displayName: 'Charlie Brown',
        about: 'Charlie here!',
        isOnline: true,
      },
      {
        username: 'diana',
        email: 'diana@example.com',
        password: 'password123',
        displayName: 'Diana Prince',
        about: 'Diana speaking',
        isOnline: false,
      },
    ]);

    console.log('Creating sample 1-on-1 chat...');
    const directChat = await Chat.create({
      isGroup: false,
      participants: [users[0]._id, users[1]._id],
      unreadCounts: new Map([[users[0]._id.toString(), 0], [users[1]._id.toString(), 2]]),
    });

    console.log('Creating sample messages...');
    const messages = await Message.create([
      {
        chat: directChat._id,
        sender: users[0]._id,
        type: 'text',
        content: 'Hey Bob! How are you?',
        status: 'read',
        readBy: [
          { user: users[0]._id, readAt: new Date() },
          { user: users[1]._id, readAt: new Date() },
        ],
        deliveredTo: [
          { user: users[0]._id, deliveredAt: new Date() },
          { user: users[1]._id, deliveredAt: new Date() },
        ],
      },
      {
        chat: directChat._id,
        sender: users[1]._id,
        type: 'text',
        content: 'I am doing great! Thanks for asking!',
        status: 'delivered',
        readBy: [{ user: users[1]._id, readAt: new Date() }],
        deliveredTo: [
          { user: users[1]._id, deliveredAt: new Date() },
          { user: users[0]._id, deliveredAt: new Date() },
        ],
      },
    ]);

    // Update last message in chat
    await Chat.updateOne(
      { _id: directChat._id },
      {
        $set: {
          'lastMessage.messageId': messages[1]._id,
          'lastMessage.content': messages[1].content,
          'lastMessage.sender': users[1]._id,
          'lastMessage.type': 'text',
          'lastMessage.sentAt': messages[1].createdAt,
        },
      }
    );

    console.log('Creating sample group chat...');
    const groupChat = await Chat.create({
      isGroup: true,
      name: 'Development Team',
      description: 'Team chat for development discussions',
      createdBy: users[0]._id,
      participants: [users[0]._id, users[1]._id, users[2]._id],
      admins: [users[0]._id],
      unreadCounts: new Map([
        [users[0]._id.toString(), 0],
        [users[1]._id.toString(), 1],
        [users[2]._id.toString(), 1],
      ]),
    });

    console.log('Creating group system message...');
    const groupSystemMessage = await Message.create({
      chat: groupChat._id,
      sender: null,
      type: 'system',
      content: 'Alice created the group',
      status: 'sent',
    });

    // Update last message in group chat
    await Chat.updateOne(
      { _id: groupChat._id },
      {
        $set: {
          'lastMessage.messageId': groupSystemMessage._id,
          'lastMessage.content': groupSystemMessage.content,
          'lastMessage.type': 'system',
          'lastMessage.sentAt': groupSystemMessage.createdAt,
        },
      }
    );

    console.log('✓ Database seeded successfully!');
    console.log('\nSample Users:');
    users.forEach((user) => {
      console.log(`  - ${user.displayName} (${user.email})`);
    });
    console.log('\nSample Chats:');
    console.log(`  - 1-on-1: ${users[0].displayName} ↔ ${users[1].displayName}`);
    console.log(`  - Group: ${groupChat.name}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('✗ Seed failed:', error);
    process.exit(1);
  }
}

seed();
