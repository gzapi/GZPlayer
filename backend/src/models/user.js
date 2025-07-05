import bcrypt from 'bcrypt';
import { DataTypes } from 'sequelize';
import BaseModel from './base_model.js';

export default (sequelize) => {
    class User extends BaseModel {
        static associate(models) {
            User.hasMany(models.Favorite, {
                foreignKey: 'user_id',
                as: 'favorites',
                onDelete: 'CASCADE'
            });
            User.hasMany(models.UserSession, {
                foreignKey: 'user_id',
                as: 'user_sessions',
                onDelete: 'CASCADE'
            });
        }

        setPassword(password) {
            const salt = bcrypt.genSaltSync(10);
            this.password_hash = bcrypt.hashSync(password, salt);
        }

        async checkPassword(password) {
            return bcrypt.compareSync(password, this.password_hash);
        }

        toDict(includeSensitive = false) {
            const base = super.toDict();
            return {
                ...base,
                username: this.username,
                email: this.email,
                first_name: this.first_name,
                last_name: this.last_name,
                is_active: this.is_active,
                last_login: this.last_login ? this.last_login.toISOString() : null,
                full_name: `${this.first_name || ''} ${this.last_name || ''}`.trim(),
                ...(includeSensitive && { favorites_count: this.favorites?.length ?? 0 })
            };
        }
    }

    User.init({
        username: {
            type: DataTypes.STRING(80),
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING(120),
            allowNull: false,
            unique: true
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false
        },
        first_name: DataTypes.STRING(50),
        last_name: DataTypes.STRING(50),
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        last_login: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        underscored: true,
        timestamps: true
    });

    return User;
};