import { DataTypes } from 'sequelize';
import sequelize from '../database/db.js';

// Importa os modelos como funções que recebem (sequelize)
import UserModel from './user.js';
import UserSessionModel from './user_session.js';
import FavoriteModel from './favorite.js';
import FavoriteCategoryModel from './favorite_category.js';
import FavoriteCategoryItemsModel from './favorite_category_items.js';

// Inicializa modelos
const User = UserModel(sequelize, DataTypes);
const UserSession = UserSessionModel(sequelize);
const Favorite = FavoriteModel(sequelize);
const FavoriteCategory = FavoriteCategoryModel(sequelize);
const FavoriteCategoryItems = FavoriteCategoryItemsModel(sequelize, DataTypes);

// Associações
User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(UserSession, { foreignKey: 'user_id', as: 'user_sessions' });
UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(FavoriteCategory, { foreignKey: 'user_id', as: 'favorite_categories' });
FavoriteCategory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Relação many-to-many Favorite <-> FavoriteCategory via favorite_category_items
Favorite.belongsToMany(FavoriteCategory, {
    through: FavoriteCategoryItems,
    foreignKey: 'favorite_id',
    otherKey: 'category_id',
    as: 'categories'
});
FavoriteCategory.belongsToMany(Favorite, {
    through: FavoriteCategoryItems,
    foreignKey: 'category_id',
    otherKey: 'favorite_id',
    as: 'favorites'
});

export {
    sequelize,
    User,
    UserSession,
    Favorite,
    FavoriteCategory,
    FavoriteCategoryItems
};