export function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => resolve(Math.round(audio.duration)));
    audio.addEventListener('error', () => resolve(0));
    audio.load();
  });
}
