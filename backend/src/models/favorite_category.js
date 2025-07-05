import { DataTypes } from 'sequelize';
import BaseModel from './base_model.js';

export default (sequelize) => {
    class FavoriteCategory extends BaseModel {
        toDict() {
            const base = super.toDict();
            return {
                ...base,
                user_id: this.user_id,
                name: this.name,
                description: this.description,
                color: this.color,
                icon: this.icon,
                is_default: this.is_default,
                favorites_count: this.favorites?.length ?? 0
            };
        }

        static associate(models) {
            FavoriteCategory.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
            FavoriteCategory.belongsToMany(models.Favorite, {
                through: 'favorite_category_items',
                foreignKey: 'category_id',
                otherKey: 'favorite_id',
                as: 'favorites'
            });
        }
    }

    FavoriteCategory.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        description: DataTypes.TEXT,
        color: DataTypes.STRING(7),
        icon: DataTypes.STRING(50),
        is_default: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'FavoriteCategory',
        tableName: 'favorite_categories',
        underscored: true,
        timestamps: true,
        uniqueKeys: {
            unique_user_category: {
                fields: ['user_id', 'name']
            }
        }
    });

    return FavoriteCategory;
};