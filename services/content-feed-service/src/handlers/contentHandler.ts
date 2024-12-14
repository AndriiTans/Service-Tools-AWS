import { Request, Response } from 'express';
import Message from '../models/message.model';

export const getParsedContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.query;

    if (!fileName) {
      res.status(400).json({ error: 'fileName query parameter is required.' });
      return;
    }

    const messages = await Message.find({ fileName }).sort({ order: 1 }).exec(); // Sort by 'order' in ascending order

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
    console.log('uniqueFilenames -> ');
    const uniqueFilenames = await Message.distinct('fileName');

    if (!uniqueFilenames || uniqueFilenames.length === 0) {
      res.status(404).json({ message: 'No filenames found' });
      return;
    }

    console.log('uniqueFilenames ', uniqueFilenames);

    res.status(200).json(uniqueFilenames);
  } catch (error) {
    console.error('Error fetching unique filenames:', error);
    res.status(500).json({ error: 'Failed to fetch unique filenames from the database.' });
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
