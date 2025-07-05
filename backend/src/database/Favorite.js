import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';
import User from './User.js';

class Favorite extends Model {}

Favorite.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    item_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    item_type: {
        type: DataTypes.ENUM('channel', 'movie', 'series'),
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    subtitle: DataTypes.STRING(255),
    description: DataTypes.TEXT,
    image_url: DataTypes.STRING(500),
    url: DataTypes.STRING(500),
    genre: DataTypes.STRING(100),
    duration: DataTypes.INTEGER,
    seasons: DataTypes.INTEGER,
    year: DataTypes.INTEGER,
    rating: DataTypes.FLOAT,
    extra_data: DataTypes.JSONB, // JSON no postgres
}, {
    sequelize,
    modelName: 'Favorite',
    tableName: 'favorites',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'item_id', 'item_type']
        }
    ]
});

// Relacionamento
Favorite.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Favorite, { foreignKey: 'user_id' });

export default Favorite;