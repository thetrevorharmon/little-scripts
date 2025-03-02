const WORKING_COPY_DIRECTORY = '_scratch/photo-query';
const SMALL_VIDEOS_DUMP_FILE_PATH = `${WORKING_COPY_DIRECTORY}/small-videos-dump.txt`;

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

    const smallVideos = JSON.parse(smallVideosJsonDump).map((video) => ({
      uuid: video.uuid,
      originalDate: video.date_original,
      date: video.date,
      filename: video.filename,
      filenameOriginal: video.original_filename,
    }));

    console.log(smallVideos[0]);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
