import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';

interface PipelineStatus {
  isRunning: boolean;
  lastRun?: string;
  lastResult?: {
    success: boolean;
    platforms: Record<string, unknown>;
    normalized: number;
    filtered: number;
  };
}

// In-memory status (in production, use Redis or database)
let status: PipelineStatus = {
  isRunning: false,
};

class PipelineController {
  /**
   * GET /api/pipeline/status - Get pipeline status
   */
  getStatus(_req: Request, res: Response): void {
    res.json(status);
  }

  /**
   * POST /api/pipeline/trigger - Manually trigger the pipeline
   */
  async triggerPipeline(_req: Request, res: Response): Promise<void> {
    if (status.isRunning) {
      res.status(409).json({ error: 'Pipeline is already running' });
      return;
    }

    status.isRunning = true;
    res.json({
      message: 'Pipeline trigger started',
      startTime: new Date().toISOString(),
    });

    // Run pipeline in background
    this.runPipelineInBackground();
  }

  /**
   * Run the BrightData pipeline as a background process
   */
  private runPipelineInBackground(): void {
    const brightdataPath = path.resolve(__dirname, '../../../brightdata');
    const scriptPath = path.join(brightdataPath, 'scripts/run_pipeline.py');

    const process = spawn('uv', ['run', 'python', scriptPath], {
      cwd: brightdataPath,
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Pipeline] ${data}`);
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[Pipeline Error] ${data}`);
    });

    process.on('close', (code) => {
      status.isRunning = false;
      status.lastRun = new Date().toISOString();

      const success = code === 0;
      status.lastResult = {
        success,
        platforms: {},
        normalized: 0,
        filtered: 0,
      };

      if (success) {
        console.log('[Pipeline] Completed successfully');
      } else {
        console.error(`[Pipeline] Failed with code ${code}`);
        console.error(`[Pipeline] Error output: ${errorOutput}`);
      }
    });

    process.on('error', (err) => {
      status.isRunning = false;
      status.lastRun = new Date().toISOString();
      console.error(`[Pipeline] Failed to start: ${err}`);
    });
  }
}

export default new PipelineController();
