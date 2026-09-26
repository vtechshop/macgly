import { useState, useRef, useEffect } from 'react';
import { Upload, X, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../utils/api';
import { normalizeImageUrl } from '../../../utils/format';
import toast from 'react-hot-toast';

export default function ImageUpload({ urls = [], onChange, uploadUrl = '/admin/upload/image' }) {
  const [uploading, setUploading] = useState(false);
  const [viewIdx, setViewIdx] = useState(null);
  const inputRef = useRef(null);

  const viewing = viewIdx !== null && urls[viewIdx] ? viewIdx : null;
  const step = (d) => setViewIdx((i) => (i + d + urls.length) % urls.length);

  useEffect(() => {
    if (viewing === null) return;
    function onKey(e) {
      if (e.key === 'Escape') setViewIdx(null);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing, urls.length]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        const { data } = await api.post(`${uploadUrl}?folder=products`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(data.url);
      }
      onChange([...urls, ...uploaded]);
      toast.success(`${uploaded.length} image(s) uploaded`);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removeUrl(idx) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-secondary-700">Product Images</label>

      {/* Previews */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group w-20 h-20">
              <button type="button" onClick={() => setViewIdx(i)} aria-label={`View image ${i + 1}`}
                className="w-full h-full cursor-zoom-in rounded border border-secondary-200 bg-secondary-50 hover:border-primary-400 transition-colors">
                <img src={normalizeImageUrl(url)} alt="" className="w-full h-full object-contain rounded" onError={(e) => e.target.style.display='none'} />
              </button>
              <button type="button" onClick={() => removeUrl(i)} aria-label={`Remove image ${i + 1}`}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-secondary-300 rounded hover:border-primary-400 hover:bg-primary-50 text-secondary-600 hover:text-primary-700 transition-colors disabled:opacity-50">
          {uploading ? <><Upload size={14} className="animate-bounce" /> Uploading...</> : <><ImagePlus size={14} /> Upload Images</>}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>

      {/* Manual URL input */}
      <div className="space-y-1">
        <label className="block text-xs text-secondary-500">Or paste image URLs (one per line)</label>
        <textarea
          className="input h-16 resize-none font-mono text-xs"
          placeholder="Enter image URL"
          value={urls.join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n').map((u) => u.trim()).filter(Boolean))}
        />
      </div>

      {viewing !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={() => setViewIdx(null)}
          role="dialog" aria-modal="true" aria-label={`Image ${viewing + 1} of ${urls.length}`}>
          <img src={normalizeImageUrl(urls[viewing])} alt="" onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg bg-white shadow-2xl" />
          <button type="button" onClick={() => setViewIdx(null)} aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center">
            <X size={20} />
          </button>
          {urls.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center">
                <ChevronLeft size={22} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center">
                <ChevronRight size={22} />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
                {viewing + 1} / {urls.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
