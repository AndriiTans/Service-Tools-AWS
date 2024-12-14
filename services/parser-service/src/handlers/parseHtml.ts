// @ts-nocheck
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const parseHtmlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    console.log('filePath -> ', filePath);
    const readStream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    let content = '';
    const CHECKED_KEY = 'linear_conversation';
    let iterationCheckedKey = 0;
    let finished = false;
    let openSymbols = 0;

    const AFTER_CONTENT_KEY = ',"has_user_editable_context":';

    let savingStarted = false;
    let savingFinished = false;

    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const outputFileName = `${req.file.filename}.json`;
    const outputFilePath = path.join(uploadsDir, outputFileName);
    const writeStream = fs.createWriteStream(outputFilePath);

    readStream.on('data', (chunk) => {
      let i = 0;

      while (i < chunk.length) {
        if (!finished) {
          if (CHECKED_KEY[iterationCheckedKey] === chunk[i]) {
            iterationCheckedKey++;
          } else {
            iterationCheckedKey = 0;
          }
        }

        if (iterationCheckedKey === CHECKED_KEY.length) {
          finished = true;
        }

        if (finished && !savingFinished) {
          if (chunk[i] === '[' || chunk[i] === '{') {
            savingStarted = true;
            openSymbols++;
          } else if (chunk[i] === ']' || chunk[i] === '}') {
            openSymbols--;
          }

          if (savingStarted && !savingFinished) {
            content += chunk[i];
          }

          if (savingStarted && openSymbols <= 0) {
            savingFinished = true;
            break;
          }
        }

        i++;
      }

      writeStream.write(content);
      content = '';
    });

    readStream.on('end', () => {
      console.log('Processing complete. The content has been written to the file.');

      writeStream.end();

      const outputReadStream = fs.createReadStream(outputFilePath, { encoding: 'utf-8' });
      let jsonContent = '';

      outputReadStream.on('data', (chunk) => {
        jsonContent += chunk;
      });

      outputReadStream.on('end', () => {
        try {
          const index = jsonContent.indexOf(AFTER_CONTENT_KEY);
          if (index !== -1) {
            jsonContent = jsonContent.substring(0, index); // Trim everything after AFTER_CONTENT_KEY
          }
          const parsedContent = JSON.parse(jsonContent);

          const filteredContent = parsedContent.filter((el) => {
            const role = el?.message?.author?.role;

            return role === 'user' || role === 'assistant';
          });

          const transformedContent = filteredContent.map((contentItem) => {
            return {
              author: contentItem?.message?.author,
              ...contentItem?.message?.content,
            };
          });

          res.status(200).json({
            message: 'File processed and saved successfully',
            filePath: outputFilePath,
            content: transformedContent,
          });
        } catch (parseErr) {
          console.error('Error parsing the saved file content:', parseErr);
          res
            .status(500)
            .json({ message: 'Error parsing the saved file content', error: parseErr });
        }
      });

      outputReadStream.on('error', (err) => {
        console.error('Error reading the saved file:', err);
        res.status(500).json({ message: 'Error reading the saved file', error: err });
      });
    });

    readStream.on('error', (err) => {
      console.error('Error reading file:', err);
      res.status(500).json({ message: 'Server error', error: err });
    });

    writeStream.on('error', (err) => {
      console.error('Error writing to the file:', err);
      res.status(500).json({ message: 'Error writing to file', error: err });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export default parseHtmlHandler;
