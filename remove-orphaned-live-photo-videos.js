const { spawn } = require('child_process');
const fs = require('fs');

const DATE_OF_LIVE_PHOTOS_START = '2016-11-01';

const CACHE_DIRECTORY =
  '.cache/little-scripts/remove-orphaned-live-photo-videos';
const RAW_VIDEOS_METADATA = `${CACHE_DIRECTORY}/videos.txt`;
const RAW_PHOTOS_METADATA = `${CACHE_DIRECTORY}/photos.txt`;
const MATCHING_VIDEOS_UUIDS = `${CACHE_DIRECTORY}/matching-videos-uuids.txt`;

// osxphotos query --only-movies --min-size 200MB --add-to-album "Big Videos"

// --uuid <UUID>
// Search for photos with UUID(s). May be repeated to include multiple UUIDs.

// --uuid-from-file <FILE>
// Search for photos with UUID(s) loaded from FILE. Format is a single UUID per line. Lines preceded with # are ignored. If FILE is ' -', read UUIDs from stdin.

// The sizes here are a bit arbitrary, they might need to be adjusted accordingly
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
  // List all of the photos that are 6mb or smaller that were taken after November 1st, 2016
  photoMetadata: [
    'query',
    '--only-photos',
    '--max-size',
    // 6mb in bytes
    '6291456',
    '--from-date',
    DATE_OF_LIVE_PHOTOS_START,
    '--json',
  ],
  // Add all of the matching videos to the "Orphaned videos" album
  addVideosToAlbum: [
    'query',
    '--only-movies',
    '--uuid-from-file',
    `"${MATCHING_VIDEOS_UUIDS}"`,
    '--add-to-album',
    '"Orphaned videos"',
  ],
};

function spawnCommand(requestedCommand, args) {
  return new Promise((resolve, reject) => {
    let output = '';

    console.log('📟 Running command:', requestedCommand, args.join(' '));
    const command = spawn(requestedCommand, args);

    command.stdout.on('data', (data) => {
      output += data;
    });

    command.stderr.on('data', (data) => {
      // console.error(data.toString());
      // This is a bit of a hack to get the output of the command
      // to be overwritten on the same line. That way it is a little tidier
      process.stdout.write('\r\x1b[K');
      process.stdout.write(`\r${data.toString().trim()}`);
    });

    command.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

async function main() {
  let videoMetadata, photoMetadata;

  console.log('⏳ Ensuring cache directory exists...');
  try {
    fs.mkdirSync(CACHE_DIRECTORY, { recursive: true });
    console.log('✅ Cache directory created');
  } catch (error) {
    if (error.code === 'EEXIST') {
      // Directory already exists - this is fine!
      console.log('✅ Cache directory already exists');
    } else {
      // Some other error occurred (permissions, disk full, etc) - this is bad!
      throw error;
    }
  }

  try {
    console.log('🔎 Looking for cached videos metadata...');

    try {
      rawVideoMetadata = fs.readFileSync(RAW_VIDEOS_METADATA, 'utf8');
      videoMetadata = JSON.parse(rawVideoMetadata);

      console.log('✅ Loaded video metadata');
    } catch {
      console.log('❌ No cached video metadata found, querying...');

      const result = await spawnCommand('osxphotos', QUERIES.videoMetadata);

      console.log('📹 Queried video metadata');

      fs.writeFileSync(RAW_VIDEOS_METADATA, result);

      console.log(`📁 Wrote results to ${RAW_VIDEOS_METADATA}`);

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

      console.log('📸 Queried photo metadata');

      fs.writeFileSync(RAW_PHOTOS_METADATA, result);

      console.log(`📁 Wrote results to ${RAW_PHOTOS_METADATA}`);

      photoMetadata = JSON.parse(result);

      console.log('✅ Loaded photo metadata');
    }

    if ('exif_info' in videoMetadata[0]) {
      console.log('⏳ Simplifying video metadata...');

      videoMetadata = videoMetadata.map((video) => ({
        uuid: video.uuid,
        date: video.date,
        original_filename: video.original_filename,
        filename: video.filename,
        type: 'video',
      }));

      fs.writeFileSync(
        RAW_VIDEOS_METADATA,
        JSON.stringify(videoMetadata, null, 2)
      );

      console.log(`✅ Wrote results to ${RAW_VIDEOS_METADATA}`);
    }

    if ('exif_info' in photoMetadata[0]) {
      console.log('⏳ Simplifying photo metadata...');

      photoMetadata = photoMetadata.map((photo) => ({
        uuid: photo.uuid,
        date: photo.date,
        original_filename: photo.original_filename,
        filename: photo.filename,
        type: 'photo',
      }));

      fs.writeFileSync(
        RAW_PHOTOS_METADATA,
        JSON.stringify(photoMetadata, null, 2)
      );

      console.log(`✅ Wrote results to ${RAW_PHOTOS_METADATA}`);
    }

    console.log('🔎 Finding matching videos and photos...');

    // try to load the UUIDs file

    try {
      fs.readFileSync(MATCHING_VIDEOS_UUIDS, 'utf8');

      console.log('✅ Matching videos UUIDs already generated');
    } catch {
      console.log('❌ No matching videos uuids file found, creating...');

      process.stdout.write(`Searching... 0%\r`);

      const matchingVideos = videoMetadata.filter((video, index) => {
        const percentComplete = Math.min(
          Math.round((index / photoMetadata.length) * 100 * 10) / 10,
          99.9
        );

        process.stdout.write(`\rSearching... ${percentComplete}%      \r`);

        return photoMetadata.some((photo) => {
          // Parse dates to YYYY-MM-DD format for comparison
          const photoDate = photo.date.split('T')[0];
          const videoDate = video.date.split('T')[0];

          // Strip extensions and compare filenames
          const photoFilename = stripExtension(photo.original_filename);
          const videoFilename = stripExtension(video.original_filename);

          return photoDate === videoDate && photoFilename === videoFilename;
        });
      });

      if (matchingVideos.length === 0) {
        console.log('❌ No matching videos and photos found');
        process.exit(0);
      }

      console.log(`📹 Found ${matchingVideos.length} matching videos`);
      console.log(matchingVideos);

      const matchingVideosUuids = matchingVideos.map((video) => video.uuid);

      console.log('⏳ Writing matching videos uuids to file...');

      fs.writeFileSync(MATCHING_VIDEOS_UUIDS, matchingVideosUuids.join('\n'));

      console.log(`✅ Wrote results to ${MATCHING_VIDEOS_UUIDS}`);
    }

    console.log('🔎 Adding matching videos to album...');

    // const result = await spawnCommand('osxphotos', QUERIES.addVideosToAlbum);

    console.log('✅ Added matching videos to album');
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
