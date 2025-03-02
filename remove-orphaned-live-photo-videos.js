const DATE_OF_LIVE_PHOTOS_START = '2016-11-01';

const CACHE_DIRECTORY =
  '.cache/little-scripts/remove-orphaned-live-photo-videos';
const RAW_VIDEOS_METADATA = `${CACHE_DIRECTORY}/videos.txt`;
const RAW_PHOTOS_METADATA = `${CACHE_DIRECTORY}/photos.txt`;

// osxphotos query --only-movies --min-size 200MB --add-to-album "Big Videos"

// --uuid <UUID>
// Search for photos with UUID(s). May be repeated to include multiple UUIDs.

// --uuid-from-file <FILE>
// Search for photos with UUID(s) loaded from FILE. Format is a single UUID per line. Lines preceded with # are ignored. If FILE is ‘-’, read UUIDs from stdin.

// The sizes here are a bit arbitrary, they might need to be adjusted according
const QUERIES = {
  // List all of the videos that are 7mb or smaller that were taken after November 1st, 2016
  videoMetadata: [
    'query',
    '--only-movies',
    '--max-size',
    // 7mb in bytes
    '7340032',
    '--from-date',
    DATE_OF_LIVE_PHOTOS_START,
    '--json',
  ],
  // List all of the photos that are 15mb or smaller that were taken after November 1st, 2016
  photoMetadata: [
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
  let videoMetadata, photoMetadata;

  try {
    console.log('🔎 Looking for cached videos metadata...');
    try {
      rawVideoMetadata = fs.readFileSync(RAW_VIDEOS_METADATA, 'utf8');
      videoMetadata = JSON.parse(rawVideoMetadata);

      console.log('✅ Loaded video metadata');
    } catch {
      console.log('❌ No cached video metadata found, querying...');

      const result = await spawnCommand('osxphotos', QUERIES.videoMetadata);

      // Write the result to output.ts, overwriting if it exists
      fs.writeFileSync(RAW_VIDEOS_METADATA, result);

      console.log(`📁 Successfully wrote results to ${RAW_VIDEOS_METADATA}`);

      videoMetadata = JSON.parse(result);

      console.log('✅ Loaded video metadata');
    }

    console.log('🔎 Looking for cached photos metadata...');
    try {
      rawPhotoMetadata = fs.readFileSync(RAW_PHOTOS_METADATA, 'utf8');

      photoMetadata = JSON.parse(rawPhotoMetadata);

      console.log('✅ Loaded photo metadata');
    } catch {
      console.log('❌ No cached photo metadata found, querying...');

      const result = await spawnCommand('osxphotos', QUERIES.photoMetadata);

      fs.writeFileSync(RAW_PHOTOS_METADATA, result);

      console.log(`📁 Successfully wrote results to ${RAW_PHOTOS_METADATA}`);

      photoMetadata = JSON.parse(result);

      console.log('✅ Loaded photo metadata');
    }

    console.log(videoMetadata[0]);
    console.log(photoMetadata[0]);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
