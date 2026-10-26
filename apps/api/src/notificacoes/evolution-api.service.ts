import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class EvolutionApiService {
  async enviarTexto(destino: string, texto: string): Promise<void> {
    if (typeof destino !== 'string' || !destino.trim() ||
        typeof texto !== 'string' || !texto.trim()) {
      throw new TypeError('Destino e texto são obrigatórios.');
    }

    const { baseUrl, apiKey, instance } = this.readConfig();
    const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ number: destino.trim(), text: texto }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Evolution API request failed.');
    } catch {
      throw new ServiceUnavailableException('Envio de mensagem indisponível.');
    }
  }

  private readConfig(): { baseUrl: string; apiKey: string; instance: string } {
    const rawUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_API_INSTANCE;
    if (!rawUrl || !apiKey || !instance || !/^[a-zA-Z0-9_-]+$/.test(instance)) {
      throw new ServiceUnavailableException('Envio de mensagem indisponível.');
    }

    try {
      const url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Invalid Evolution API URL.');
      }
      return { baseUrl: url.toString().replace(/\/+$/, ''), apiKey, instance };
    } catch {
      throw new ServiceUnavailableException('Envio de mensagem indisponível.');
    }
  }
}
