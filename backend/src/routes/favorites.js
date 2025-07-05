import express from 'express';
import { Op, fn, col } from 'sequelize';
import { Favorite, FavoriteCategory } from '../models/index.js'; // ajuste os imports conforme seu projeto

const favoritesRouter = express.Router();

favoritesRouter.get('/', async (req, res) => {
    try {
        const currentUserId = req.userId;

        const itemType = req.query.type;
        const categoryId = req.query.category_id;
        const search = (req.query.search || '').trim();

        const page = parseInt(req.query.page) || 1;
        const perPage = Math.min(parseInt(req.query.per_page) || 20, 100);

        let where = { user_id: currentUserId };

        if (itemType) {
            where.item_type = itemType;
        }

        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
                { genre: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Construir query com include se categoryId informado
        let queryOptions = {
            where,
            offset: (page - 1) * perPage,
            limit: perPage,
            order: [['created_at', 'DESC']]
        };

        // Ordenação customizada
        const sortBy = req.query.sort_by || 'created_at';
        const sortOrder = (req.query.sort_order || 'desc').toLowerCase();

        const sortableFields = ['title', 'rating', 'year', 'created_at'];
        if (!sortableFields.includes(sortBy)) {
            sortBy = 'created_at';
        }

        queryOptions.order = [[sortBy, sortOrder === 'asc' ? 'ASC' : 'DESC']];

        if (categoryId) {
            // Assumindo associação Favorite.belongsToMany(FavoriteCategory) via FavoriteCategoryFavorite ou similar
            queryOptions.include = [{
                model: FavoriteCategory,
                where: { id: categoryId },
                through: { attributes: [] }, // se tabela intermediária
                required: true
            }];
        }

        // Buscar favoritos e total
        const { count, rows } = await Favorite.findAndCountAll(queryOptions);

        const totalPages = Math.ceil(count / perPage);

        return res.status(200).json({
            success: true,
            favorites: rows.map(fav => fav.toJSON()),
            pagination: {
                page,
                per_page: perPage,
                total: count,
                pages: totalPages,
                has_next: page < totalPages,
                has_prev: page > 1
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar favoritos', error: error.message });
    }
});

favoritesRouter.post('/', async (req, res) => {
    try {
        const currentUserId = req.userId;
        const data = req.body;

        if (!data) {
            return res.status(400).json({ success: false, message: 'Dados do item são obrigatórios' });
        }

        // Assumindo método estático para criar favorito com dados do frontend
        const favorite = await Favorite.fromFrontendData(currentUserId, data);

        // Verificar se já existe
        const existing = await Favorite.findOne({
            where: {
                user_id: currentUserId,
                item_id: favorite.item_id,
                item_type: favorite.item_type
            }
        });

        if (existing) {
            return res.status(409).json({ success: false, message: 'Item já está nos favoritos' });
        }

        await favorite.save();

        return res.status(201).json({
            success: true,
            message: 'Item adicionado aos favoritos',
            favorite: favorite.toJSON()
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, message: 'Item já está nos favoritos' });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao adicionar favorito', error: error.message });
    }
});

favoritesRouter.delete('/:favoriteId', async (req, res) => {
    try {
        const currentUserId = req.userId;
        const favoriteId = parseInt(req.params.favoriteId);

        const favorite = await Favorite.findOne({
            where: { id: favoriteId, user_id: currentUserId }
        });

        if (!favorite) {
            return res.status(404).json({ success: false, message: 'Favorito não encontrado' });
        }

        await favorite.destroy();

        return res.status(200).json({ success: true, message: 'Item removido dos favoritos' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao remover favorito', error: error.message });
    }
});

favoritesRouter.post('/check', async (req, res) => {
    try {
        const currentUserId = req.userId;
        const { item_id, item_type } = req.body;

        if (!item_id || !item_type) {
            return res.status(400).json({ success: false, message: 'item_id e item_type são obrigatórios' });
        }

        const favorite = await Favorite.findOne({
            where: { user_id: currentUserId, item_id, item_type }
        });

        return res.status(200).json({
            success: true,
            is_favorite: !!favorite,
            favorite_id: favorite?.id || null
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao verificar favorito', error: error.message });
    }
});

favoritesRouter.post('/bulk', async (req, res) => {
    try {
        const currentUserId = req.userId;
        const data = req.body;

        if (!data.items || !Array.isArray(data.items)) {
            return res.status(400).json({ success: false, message: 'Lista de itens é obrigatória' });
        }

        let addedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const itemData of data.items) {
            try {
                const favorite = await Favorite.fromFrontendData(currentUserId, itemData);

                const existing = await Favorite.findOne({
                    where: {
                        user_id: currentUserId,
                        item_id: favorite.item_id,
                        item_type: favorite.item_type
                    }
                });

                if (existing) {
                    skippedCount++;
                    continue;
                }

                await favorite.save();
                addedCount++;
            } catch (err) {
                errors.push({ item: itemData.title || 'Desconhecido', error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `${addedCount} itens adicionados, ${skippedCount} ignorados`,
            added_count: addedCount,
            skipped_count: skippedCount,
            errors
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao adicionar favoritos em lote', error: error.message });
    }
});

favoritesRouter.get('/stats', async (req, res) => {
    try {
        const currentUserId = req.userId;

        // Contar por tipo
        const stats = await Favorite.findAll({
            attributes: ['item_type', [fn('COUNT', col('id')), 'count']],
            where: { user_id: currentUserId },
            group: ['item_type']
        });

        const statsDict = {};
        stats.forEach(stat => {
            statsDict[stat.item_type] = parseInt(stat.get('count'), 10);
        });

        const total = Object.values(statsDict).reduce((a, b) => a + b, 0);

        // Gêneros populares
        const popularGenres = await Favorite.findAll({
            attributes: ['genre', [fn('COUNT', col('id')), 'count']],
            where: {
                user_id: currentUserId,
                genre: { [Op.ne]: null }
            },
            group: ['genre'],
            order: [[fn('COUNT', col('id')), 'DESC']],
            limit: 5
        });

        return res.status(200).json({
            success: true,
            stats: {
                total,
                by_type: {
                    channels: statsDict.channel || 0,
                    movies: statsDict.movie || 0,
                    series: statsDict.series || 0
                },
                popular_genres: popularGenres.map(g => ({
                    genre: g.genre,
                    count: parseInt(g.get('count'), 10)
                }))
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar estatísticas', error: error.message });
    }
});

favoritesRouter.get('/categories', async (req, res) => {
    try {
        const currentUserId = req.userId;

        const categories = await FavoriteCategory.findAll({
            where: { user_id: currentUserId },
            order: [['name', 'ASC']]
        });

        return res.status(200).json({
            success: true,
            categories: categories.map(cat => cat.toJSON())
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar categorias', error: error.message });
    }
});

favoritesRouter.post('/categories', async (req, res) => {
    try {
        const currentUserId = req.userId;
        const data = req.body;

        if (!data.name) {
            return res.status(400).json({ success: false, message: 'Nome da categoria é obrigatório' });
        }

        const category = await FavoriteCategory.create({
            user_id: currentUserId,
            name: data.name.trim(),
            description: (data.description || '').trim(),
            color: data.color,
            icon: data.icon,
            is_default: data.is_default || false
        });

        return res.status(201).json({
            success: true,
            message: 'Categoria criada com sucesso',
            category: category.toJSON()
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, message: 'Categoria com este nome já existe' });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: 'Erro ao criar categoria', error: error.message });
    }
});

export default favoritesRouter;