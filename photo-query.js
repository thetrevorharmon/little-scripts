const DATE_OF_LIVE_PHOTOS_START = '2016-11-01';

const WORKING_COPY_DIRECTORY = '_scratch/photo-query';
const SMALL_VIDEOS_DUMP_FILE_PATH = `${WORKING_COPY_DIRECTORY}/small-videos-dump.txt`;
const PHOTOS_MAYBE_CORRESPONDING_TO_SMALL_VIDEOS_DUMP_FILE_PATH = `${WORKING_COPY_DIRECTORY}/photos-maybe-corresponding-to-small-videos-dump.txt`;

// osxphotos query --only-movies --min-size 200MB --add-to-album "Big Videos"

// --uuid <UUID>
// Search for photos with UUID(s). May be repeated to include multiple UUIDs.

// --uuid-from-file <FILE>
// Search for photos with UUID(s) loaded from FILE. Format is a single UUID per line. Lines preceded with # are ignored. If FILE is ‘-’, read UUIDs from stdin.

const QUERIES = {
  smallVideos: [
    'query',
    '--only-movies',
    '--max-size',
    // 7mb in bytes
    '7340032',
    '--from-date',
    DATE_OF_LIVE_PHOTOS_START,
    '--json',
  ],
  photosMaybeCorrespondingToSmallVideos: [
    'query',
    '--only-photos',
    '--max-size',
    // 15mb in bytes
    '15728640',
    '--from-date',
    DATE_OF_LIVE_PHOTOS_START,
    '--json',
  ],
};

const { spawn } = require('child_process');
const fs = require('fs');

function spawnCommand(command, args) {
  return new Promise((resolve, reject) => {
    let output = '';
    const process = spawn(command, args);

    process.stdout.on('data', (data) => {
      output += data;
      console.log(data.toString()); // Show output in real-time
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    let smallVideosJsonDump;

    // Check if existing small videos dump exists
    try {
      smallVideosJsonDump = fs.readFileSync(
        SMALL_VIDEOS_DUMP_FILE_PATH,
        'utf8'
      );
      console.log('Found existing small videos dump');
    } catch (error) {
      // no valid existing dump
    }

    if (smallVideosJsonDump == null) {
      // Execute the command and get the output
      const result = await spawnCommand('osxphotos', [
        'query',
        '--only-movies',
        '--max-size',
        '7340032',
        '--json',
      ]);

      // Write the result to output.ts, overwriting if it exists
      fs.writeFileSync(SMALL_VIDEOS_DUMP_FILE_PATH, result);

      console.log(
        `Successfully wrote results to ${SMALL_VIDEOS_DUMP_FILE_PATH}`
      );

      smallVideosJsonDump = result;
    }

    let photosMaybeCorrespondingToSmallVideosJsonDump;

    try {
      photosMaybeCorrespondingToSmallVideosJsonDump = fs.readFileSync(
        PHOTOS_MAYBE_CORRESPONDING_TO_SMALL_VIDEOS_DUMP_FILE_PATH,
        'utf8'
      );
    } catch (error) {
      // no valid existing dump
    }

    if (photosMaybeCorrespondingToSmallVideosJsonDump == null) {
      const result = await spawnCommand('osxphotos', [
        'query',
        '--only-photos',
        '--max-size',
        '15728640',
        '--json',
      ]);

      fs.writeFileSync(
        PHOTOS_MAYBE_CORRESPONDING_TO_SMALL_VIDEOS_DUMP_FILE_PATH,
        result
      );

      photosMaybeCorrespondingToSmallVideosJsonDump = result;
    }

    const smallVideos = JSON.parse(smallVideosJsonDump).map((video) => ({
      uuid: video.uuid,
      originalDate: video.date_original,
      date: video.date,
      filename: video.filename,
      filenameOriginal: video.original_filename,
    }));

    console.log(smallVideos[0]);
    console.log(photosMaybeCorrespondingToSmallVideos[0]);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
