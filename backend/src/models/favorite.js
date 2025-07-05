import { DataTypes } from 'sequelize';
import BaseModel from './base_model.js';

export default (sequelize) => {
    class Favorite extends BaseModel {
        toDict() {
            const base = super.toDict();
            return {
                ...base,
                user_id: this.user_id,
                item_id: this.item_id,
                item_type: this.item_type,
                title: this.title,
                subtitle: this.subtitle,
                description: this.description,
                image_url: this.image_url,
                url: this.url,
                genre: this.genre,
                duration: this.duration,
                seasons: this.seasons,
                year: this.year,
                rating: this.rating,
                metadata: this.extra_data || {}
            };
        }

        static fromFrontendData(userId, item) {
            let itemType = 'channel';
            if (item.duration) itemType = 'movie';
            else if (item.seasons) itemType = 'series';
            else if (item.url?.endsWith('.m3u8')) itemType = 'channel';

            return {
                user_id: userId,
                item_id: item.id || '',
                item_type: itemType,
                title: item.title || item.name || 'Sem título',
                subtitle: item.subtitle,
                description: item.description,
                image_url: item.logo || item.image,
                url: item.url,
                genre: item.genre,
                duration: item.duration,
                seasons: item.seasons,
                year: item.year,
                rating: item.rating,
                extra_data: item.metadata || {}
            };
        }

        static associate(models) {
            Favorite.belongsToMany(models.FavoriteCategory, {
                through: 'favorite_category_items',
                foreignKey: 'favorite_id',
                otherKey: 'category_id',
                as: 'categories'
            });
            Favorite.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }

    Favorite.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        item_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        item_type: {
            type: DataTypes.ENUM('channel', 'movie', 'series'),
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        subtitle: DataTypes.STRING,
        description: DataTypes.TEXT,
        image_url: DataTypes.STRING,
        url: DataTypes.STRING,
        genre: DataTypes.STRING,
        duration: DataTypes.INTEGER,
        seasons: DataTypes.INTEGER,
        year: DataTypes.INTEGER,
        rating: DataTypes.FLOAT,
        extra_data: DataTypes.JSONB
    }, {
        sequelize,
        modelName: 'Favorite',
        tableName: 'favorites',
        underscored: true,
        timestamps: true,
        indexes: [
            { fields: ['item_id'] }
        ],
        uniqueKeys: {
            unique_user_favorite: {
                fields: ['user_id', 'item_id', 'item_type']
            }
        }
    });

    return Favorite;
};