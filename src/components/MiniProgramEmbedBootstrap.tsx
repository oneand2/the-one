'use client';

import { useEffect } from 'react';
import { rememberMiniProgramEmbed } from '@/utils/iosEmbed';

export function MiniProgramEmbedBootstrap() {
  useEffect(() => {
    rememberMiniProgramEmbed();
  }, []);
  return null;
}
