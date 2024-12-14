import { Request, Response } from 'express';
import Message from '../models/message.model';

const USER_ROLE = 'user';

export const getParsedContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.query;

    if (!fileName) {
      res.status(400).json({ error: 'fileName query parameter is required.' });
      return;
    }

    const messages = await Message.find({ fileName }).sort({ order: 1 }).exec();

    if (!messages || messages.length === 0) {
      res.status(404).json({ message: 'No messages found matching the criteria.' });
      return;
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages from the database.' });
  }
};

export const getUniqueFilenames = async (req: Request, res: Response): Promise<void> => {
  try {
    const uniqueFilenames = await Message.distinct('fileName');

    if (!uniqueFilenames || uniqueFilenames.length === 0) {
      res.status(404).json({ message: 'No filenames found' });
      return;
    }

    res.status(200).json(uniqueFilenames);
  } catch (error) {
    console.error('Error fetching unique filenames:', error);
    res.status(500).json({ error: 'Failed to fetch unique filenames from the database.' });
  }
};

export const getAllUserMessagesInAllFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const userMessages = await Message.find({ authorRole: USER_ROLE }).sort({ order: 1 }).lean();

    if (!userMessages.length) {
      res.status(404).json({ message: 'No user messages found' });
      return;
    }

    const messages = userMessages.map((el) => el.content);
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching all user messages:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch all user messages from the database.' });
  }
};

export const getAllUserMessagesByFilename = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileNames } = req.body;

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      res
        .status(400)
        .json({ error: 'fileNames parameter is required and should be a non-empty array.' });
      return;
    }

    const userMessages = await Message.find({
      fileName: { $in: fileNames },
      authorRole: USER_ROLE,
    })
      .sort({ order: 1 })
      .lean();

    if (!userMessages.length) {
      res.status(404).json({ message: 'No user messages found for the specified files' });
      return;
    }
    //
    const groupedMessages = fileNames.map((fileName) => {
      const messagesForFile = userMessages.filter((el) => el.fileName === fileName);
      const content = messagesForFile.map((el) => el.content);

      return {
        fileName,
        content,
      };
    });

    res.status(200).json(groupedMessages);
  } catch (error) {
    console.error('Error fetching user messages by filename:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch user messages from the database.' });
  }
};

export const deleteMessagesByFileName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.query;

    if (!fileName) {
      res.status(400).json({ error: 'fileName query parameter is required.' });
      return;
    }

    const result = await Message.deleteMany({ fileName });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'No messages found to delete for the given fileName.' });
      return;
    }

    res.status(200).json({ message: `Successfully deleted ${result.deletedCount} messages.` });
  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({ error: 'Failed to delete messages from the database.' });
  }
};
