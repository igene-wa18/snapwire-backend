import { Request, Response } from 'express';
import User from '../models/User';
import FriendRequest from '../models/FriendRequest';
import Conversation from '../models/Conversation';
import { getIO } from '../socket';

// Interface to handle the user object attached by your auth middleware
interface AuthRequest extends Request {
  user?: any; 
}

const emitToUser = (userId: string, event: string, data: any): void => {
  const io = getIO();
  io.to(`user:${userId}`).emit(event, data);
};

export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user._id;
    const { targetId } = req.params;

    const [target, pendingReq] = await Promise.all([
      User.findById(targetId).select('friends blockedUsers').lean(),
      FriendRequest.findOne({
        $or: [
          { sender: me, receiver: targetId, status: 'pending' },
          { sender: targetId, receiver: me, status: 'pending' },
        ],
      }).lean(),
    ]);

    if (!target) return res.status(404).json({ message: 'User not found' });

    const imBlocked = target.blockedUsers?.some((id: any) => id.toString() === me.toString());
    if (imBlocked) return res.json({ data: { status: 'blocked' } });

    const meDoc: any = await User.findById(me).select('friends blockedUsers').lean();
    const iBlocked = meDoc?.blockedUsers?.some((id: any) => id.toString() === targetId.toString());
    if (iBlocked) return res.json({ data: { status: 'blocked' } });

    const areFriends = meDoc?.friends?.some((id: any) => id.toString() === targetId.toString());
    if (areFriends) return res.json({ data: { status: 'friends' } });

    if (pendingReq) {
      const status = pendingReq.sender.toString() === me.toString()
        ? 'pending_sent'
        : 'pending_received';
      return res.json({ data: { status } });
    }

    return res.json({ data: { status: 'none' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendRequest = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user._id;
    const { targetId } = req.params;

    if (me.toString() === targetId) return res.status(400).json({ message: "Can't add yourself" });

    const target: any = await User.findById(targetId).select('blockedUsers').lean();
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.blockedUsers?.some((id: any) => id.toString() === me.toString())) {
      return res.status(403).json({ message: 'Unable to send request' });
    }

    const existing = await FriendRequest.findOne({ sender: me, receiver: targetId, status: 'pending' });
    if (existing) return res.status(409).json({ message: 'Request already sent' });

    const request = await FriendRequest.create({ sender: me, receiver: targetId });

    emitToUser(targetId, 'friend_request_received', { requestId: request._id, from: me });

    res.status(201).json({ data: { request } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const acceptRequest = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user._id;
    const { requesterId } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { sender: requesterId, receiver: me, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await Promise.all([
      User.findByIdAndUpdate(me, { $addToSet: { friends: requesterId } }),
      User.findByIdAndUpdate(requesterId, { $addToSet: { friends: me } }),
    ]);

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [me, requesterId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        isGroup: false,
        participants: [me, requesterId],
      });
    }

    emitToUser(requesterId, 'friend_request_accepted', { from: me, conversationId: conversation._id });

    res.json({ data: { status: 'friends', conversationId: conversation._id } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ... (You can follow this pattern for unfriend, block, and getMutualFriends)