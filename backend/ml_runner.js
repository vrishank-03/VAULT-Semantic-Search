const { spawn } = require('child_process');
const path = require('path');

const runMLTest = () => {
  return new Promise((resolve, reject) => {
    // Correctly reference the python executable in the venv
    const pythonExecutable = path.join(__dirname, 'ml_env', 'Scripts', 'python.exe');
    const pythonProcess = spawn(pythonExecutable, ['pipeline_test.py']);

    let dataString = '';
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stdout.on('end', () => {
      try {
        resolve(JSON.parse(dataString));
      } catch (e) {
        reject(new Error("Failed to parse Python script output."));
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      reject(new Error(`Python script error: ${data}`));
    });
  });
};

module.exports = { runMLTest };