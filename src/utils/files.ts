import {DIRECTORIES, FILES} from '~/constants/files';
import {getPath} from '.';
import {existsSync, mkdirSync, readFileSync, rmdir, rm, stat, writeFileSync,} from 'fs';

export const checkFiles = () => {
  for (const dir of DIRECTORIES) {
    const path = getPath(dir);
    if (!existsSync(path)) {
      mkdirSync(path);
    }
  }

  Object.keys(FILES).forEach((key) => {
    const defaultContent = (FILES as any)[key];
    const path = getPath(key);

    if (!existsSync(path)) {
      writeFileSync(path, JSON.stringify(defaultContent));
    }
  });
};

export const pathExists = (path: string) => {
  return new Promise((resolve) => {
    stat(path, (error) => {
      resolve(!error);
    });
  });
};
export const isExpire = (path: string, hour: Number) => {
  return new Promise((resolve) => {
    stat(path, (error, stats) => {
      if (error) {
        resolve(true);
        return
      }
      const modifiedTime = stats.mtime;
      const currentTime = new Date();
      const timeDiff = currentTime.getTime() - modifiedTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      if (hoursDiff <= hour) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}
export const deletePath = (path: string) => {
  return new Promise((resolve, reject) => {
    stat(path, (error, stats) => {
      if(!error) {
        if(stats.isDirectory()) {
          rmdir(path, (error) => {
            resolve(!error);
          });
        } else {
          rm(path, (error) => {
            resolve(!error);
          });
        }
      } else {
        resolve(true);
      }
    });
  });
};
export const deleteDir = (path: string) => {
  return new Promise((resolve) => {
    rmdir(path, (error) => {
      resolve(!error);
    });
  });
};
export const readFileAsText = (filePath: string) => {
  if (existsSync(filePath)) {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`Failed to read file: ${error}`);
      return null;
    }
  } else {
    console.error('File does not exist');
    return null;
  }
}
export const writeFileText = (filePath: string, text: string) => {
    try {
      writeFileSync(filePath, text, 'utf8');
    } catch (error) {
      console.error(`Failed to write file: ${error}`);
    }
}
