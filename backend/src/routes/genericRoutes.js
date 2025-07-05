import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import axios from 'axios';
import sharp from 'sharp';

import index from '../index.js';
import M3UItem from '../database/M3UItem.js';

const genericRouter = express.Router();

// Middleware para proteger rota, se quiser
genericRouter.post('/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.playlist) {
            return res.status(400).json({ status: 400, message: 'Nenhum arquivo enviado.' });
        }

        const file = req.files.playlist;

        // Salvar temporariamente
        const tempPath = path.join(index.__dirtemp, file.name);
        await file.mv(tempPath);

        // Ler e parsear
        const content = await fs.readFile(tempPath, 'utf-8');
        const parsedItems = parseM3U(content);

        // Montar array para bulkCreate
        const userId = req.headers.authorization;

        const itemsToSave = await Promise.all(
            parsedItems.map(async (item, index) => {
                const groupRaw = item.attributes['group-title'] || '';
                const prefix = groupRaw.split('|')[0]?.trim().toLowerCase();
                let type = 'channel';
                let subtype = groupRaw.split('|')[1]?.trim().toLowerCase();

                if (prefix === 'series') {
                    type = 'series';
                } else if (prefix === 'movie' || prefix === 'filmes') {
                    type = 'movie';
                }

                return {
                    user_id: userId,
                    title: item.title,
                    url: item.url,
                    item_type: type,
                    item_subtype: sanitizeFileName(subtype),
                    tvg_id: item.attributes['tvg-id'],
                    tvg_name: item.attributes['tvg-name'],
                    tvg_logo: item.attributes['tvg-logo'],
                    group_title: groupRaw,
                    favorite: false,
                };
            })
        );

        // Salvar em lote
        await M3UItem.bulkCreate(itemsToSave);
        processLogosAsync(itemsToSave);

        // Apagar temporário
        await fs.unlink(tempPath);

        return res.status(200).json({
            success: true,
            message: `Arquivo ${file.name} importado com ${itemsToSave.length} itens.`,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
});

export async function processLogosAsync(items) {
    try {
        const logosDir = path.join(index.__dircache, 'logos');
        await fs.mkdir(logosDir, { recursive: true });

        for (const item of items) {
            const logoUrl = item.tvg_logo;

            if (!logoUrl) {
                console.error(`${item.title} sem logo`);
                continue;
            }

            const filename = `${sanitizeFileName(item.title)}.jpg`;
            const filepath = path.join(logosDir, filename);
            let localUrl = `/cache/logos/${filename}`;

            try {
                const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
                await sharp(response.data).resize(300).jpeg({ quality: 70 }).toFile(filepath);
            } catch (error) {
                localUrl = '';
                console.warn(`Erro ao baixar logo de ${item.title}:`, error.message);
            }

            try {
                await M3UItem.update(
                    { tvg_logo: localUrl },
                    { where: { user_id: item.user_id, title: item.title } }
                );              
            } catch (error) {
                console.warn(`Erro ao atualizar logo de ${item.title}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Erro no processamento assíncrono de logos:', error);
    }
}

genericRouter.post('/list', async (req, res) => {
    try {
        const userId = req.headers.authorization;

        if (!userId) {
            return res.status(401).json({ message: 'UserId ausente' });
        }

        const list = await M3UItem.findAll({
            where: {
                user_id: userId
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Lista de itens obtida com sucesso',
            data: list
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
});

genericRouter.post('/logos', async (req, res) => {
    try {
        const userId = req.headers.authorization;

        if (!userId) {
            return res.status(401).json({ message: 'UserId ausente' });
        }

        return res.status(200).json({
            success: true,
            message: 'Lista de itens obtida com sucesso',
            data: list
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
});

export function parseM3U(content) {
    const lines = content.split(/\r?\n/);
    const result = [];
    let current = null;

    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            const match = line.match(/#EXTINF:-?\d*(.*?),(.*)/);

            if (!match) continue;

            const attrs = match[1];
            const title = match[2];

            const parsed = parseAttributes(attrs);
            const groupTitle = parsed['group-title'];
            let type = 'channel';
            let subtype = '';

            if (groupTitle) {
                const parts = groupTitle.split('|').map(p => p.trim());
                [type, subtype] = parts;
            }

            current = {
                title: title.trim(),
                attributes: parseAttributes(attrs),
                type: type,
                subtype: subtype
            };
        } else if (line && !line.startsWith('#') && current) {
            current.url = line.trim();

            // Detectar tipo com base no group-title
            const group = current.attributes['group-title']?.toLowerCase() || '';

            if (group.includes('series')) {
                current.type = 'series';
            } else if (group.includes('filmes') || group.includes('movies')) {
                current.type = 'movie';
            } else {
                current.type = 'channel';
            }

            result.push(current);
            current = null;
        }
    }

    return result;
}

function parseAttributes(raw) {
    const regex = /([\w-]+)="([^"]*)"/g;
    const result = {};
    let match;

    while ((match = regex.exec(raw)) !== null) {
        result[match[1]] = match[2];
    }

    return result;
}

function sanitizeFileName(name) {
    return name
        .normalize('NFD')                  // remove acentos
        .replace(/[\u0300-\u036f]/g, '')   // remove diacríticos
        .replace(/[^a-zA-Z0-9]/g, '_')     // substitui caracteres por _
        .replace(/_+/g, '_')               // remove múltiplos _
        .toLowerCase()
        .substring(0, 80);                 // limita tamanho
}

export default genericRouter;