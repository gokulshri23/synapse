'use client';

import React, { useState, useRef, useCallback } from 'react';

interface PeerArtifactDropzoneProps {
  onSubmitted: (files: File[]) => void;
  isEvaluating?: boolean;
}

export default function PeerArtifactDropzone({ onSubmitted, isEvaluating = false }: PeerArtifactDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <style>{`
        @keyframes throwIn {
          0% { transform: translateX(-100%) rotate(-15deg) scale(0.8); opacity: 0; }
          70% { transform: translateX(10px) rotate(2deg) scale(1.02); opacity: 1; }
          100% { transform: translateX(0) rotate(0) scale(1); opacity: 1; }
        }
        @keyframes floatIdle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .file-card-anim {
          animation: throwIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
                     floatIdle 4s ease-in-out infinite;
          opacity: 0; /* initial state before throwIn */
        }
      `}</style>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative min-h-[200px] border-2 border-dashed rounded-[20px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragging ? 'border-[var(--amber)] bg-[var(--amber)]/5' : 'border-[var(--border-dashed)] bg-[var(--card)] hover:bg-[var(--card-alt)]'}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
        
        <div className="mb-4 text-[var(--muted)]">
          <svg className="w-12 h-12 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p className="text-[var(--ink)] font-medium text-lg">Drop files here or click to browse</p>
          <p className="text-sm mt-1">Supports PDF, DOCX, TXT, images</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6 relative">
          {/* Dual-layer upload progress simulation */}
          {isEvaluating && (
            <div className="absolute inset-0 -mx-4 px-4 py-2 bg-gradient-to-r from-[var(--amber)] to-[var(--terracotta)] opacity-10 rounded-lg animate-pulse z-0"></div>
          )}
          
          <div className={`flex flex-col gap-3 relative z-10 ${isEvaluating ? 'backdrop-blur-[1px]' : ''}`}>
            {files.map((file, i) => (
              <div 
                key={`${file.name}-${i}`} 
                className="file-card-anim flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-[14px] shadow-sm"
                style={{ animationDelay: `${i * 0.15}s, ${0.5 + i * 0.2}s` } as React.CSSProperties}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-[var(--card-alt)] rounded-lg text-[var(--muted)]">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{file.name}</p>
                    <p className="text-xs text-[var(--muted)]">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                {!isEvaluating && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="p-2 text-[var(--muted)] hover:text-[var(--bad)] transition-colors rounded-lg hover:bg-[var(--bad)]/10"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => onSubmitted(files)}
              disabled={isEvaluating}
              className={`px-6 py-3 rounded-[14px] font-medium transition-all ${isEvaluating ? 'bg-[var(--amber)]/50 text-white cursor-wait' : 'bg-[var(--amber)] hover:bg-[var(--terracotta)] text-white'}`}
            >
              {isEvaluating ? 'Submitting...' : 'Submit for Evaluation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
