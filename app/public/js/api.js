const get = url => fetch(url).then(r => { if (!r.ok) throw r; return r.json(); });

export const fetchCourses   = ()     => get('/api/courses');
export const fetchCourse    = slug   => get('/api/courses/' + slug);
export const fetchExercises = ()     => get('/api/exercises');
export const fetchExercise  = id     => get('/api/exercises/' + id);

export function streamDeploy(id, onChunk, onDone) {
  return _stream('/api/deploy/' + id, onChunk, onDone);
}

export function streamReset(onChunk, onDone) {
  return _stream('/api/reset', onChunk, onDone);
}

async function _stream(url, onChunk, onDone) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.body) throw new Error('Pas de stream');
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      const msg = JSON.parse(part.slice(6));
      if (msg.type === 'out' || msg.type === 'err') onChunk(msg);
      if (msg.type === 'done') onDone(msg.ok);
    }
  }
}
