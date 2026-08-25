// public/audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = (options?.processorOptions?.sampleRate) || 16000;
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data?.type === "flush") {
        if (this.bufferIndex > 0) {
          this.port.postMessage(this.buffer.buffer.slice(0, this.bufferIndex));
          this.bufferIndex = 0;
        }
        return;
      }

      if (event.data.sampleRate) {
        this.sampleRate = event.data.sampleRate;
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channel = input[0];

    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bufferIndex] = channel[i];
        this.bufferIndex++;

        if (this.bufferIndex >= this.bufferSize) {
          // Send the buffer to the main thread
          this.port.postMessage(this.buffer.buffer.slice());
          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
