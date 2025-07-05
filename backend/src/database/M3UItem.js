import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';
import User from './User.js';

class M3UItem extends Model {}

M3UItem.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    item_type: {
        type: DataTypes.ENUM('channel', 'movie', 'series'),
        allowNull: false,
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    item_subtype: DataTypes.TEXT,
    item_subtype_aditional: DataTypes.TEXT,
    tvg_id: DataTypes.TEXT,
    tvg_name: DataTypes.TEXT,
    tvg_logo: DataTypes.TEXT,
    group_title: DataTypes.TEXT,
    duration: DataTypes.INTEGER,
    url: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    extra_data: DataTypes.JSONB,
    favorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    rate: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    sequelize,
    modelName: 'M3UItem',
    tableName: 'm3u_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

M3UItem.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(M3UItem, { foreignKey: 'user_id' });

export default M3UItem;