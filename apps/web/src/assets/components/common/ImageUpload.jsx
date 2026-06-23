import { useState, useRef } from 'react';
import { Upload, X, ImagePlus } from 'lucide-react';
import api from '../../../utils/api';
import { normalizeImageUrl } from '../../../utils/format';
import toast from 'react-hot-toast';

export default function ImageUpload({ urls = [], onChange, uploadUrl = '/admin/upload/image' }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

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
              <img src={normalizeImageUrl(url)} alt="" className="w-full h-full object-contain rounded border border-secondary-200 bg-secondary-50" onError={(e) => e.target.style.display='none'} />
              <button type="button" onClick={() => removeUrl(i)}
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
    </div>
  );
}
