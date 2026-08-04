import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PlayCircle } from 'lucide-react';

export const Tutorial: React.FC = () => {
  const [tutoriais, setTutoriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutoriais();
  }, []);

  const fetchTutoriais = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      if (data) setTutoriais(data);
    } catch (err) {
      console.error('Erro ao buscar tutoriais:', err);
    } finally {
      setLoading(false);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      const parsedUrl = new URL(url);
      let videoId = '';
      if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || '';
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.substring(1);
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    } catch {
      return '';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <PlayCircle size={32} color="var(--color-primary)" />
        <div>
          <h2 style={{ margin: 0 }}>Tutoriais do Sistema</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Aprenda a utilizar os recursos do sistema assistindo aos vídeos abaixo.
          </p>
        </div>
      </div>

      {loading ? (
        <div>Carregando tutoriais...</div>
      ) : tutoriais.length === 0 ? (
        <div className="blueprint card elev-sm" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
          Nenhum tutorial cadastrado no momento.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
          {tutoriais.map((tut) => {
            const embedUrl = getYoutubeEmbedUrl(tut.youtube_url);
            return (
              <div key={tut.id} className="blueprint card elev-sm" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <i className="corner tl"></i><i className="corner tr"></i><i className="corner bl"></i><i className="corner br"></i>
                
                {embedUrl ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe
                      src={embedUrl}
                      title={tut.titulo}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
                    URL Inválida
                  </div>
                )}
                
                <div style={{ padding: 'var(--space-4)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: '16px' }}>{tut.titulo}</h3>
                  {tut.descricao && (
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', flex: 1 }}>
                      {tut.descricao}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
