const { spawn } = require('child_process');
const path = require('path');

function getEmbeddings(chunks) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = path.join(__dirname, 'ml_env', 'Scripts', 'python.exe');
    const pythonProcess = spawn(pythonExecutable, ['embedder.py']);

    let dataString = '';
    let errorString = '';

    // Send the chunks to the Python script as a JSON string
    pythonProcess.stdin.write(JSON.stringify(chunks));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script exited with code ${code}: ${errorString}`));
      }
      try {
        resolve(JSON.parse(dataString));
      } catch (e) {
        reject(new Error("Failed to parse Python script output."));
      }
    });
  });
};

module.exports = { getEmbeddings };