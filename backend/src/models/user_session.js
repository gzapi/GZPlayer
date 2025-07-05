import { DataTypes } from 'sequelize';
import BaseModel from './base_model.js';

export default (sequelize) => {
    class UserSession extends BaseModel {
        toDict() {
            const base = super.toDict();
            return {
                ...base,
                user_id: this.user_id,
                expires_at: this.expires_at?.toISOString() ?? null,
                is_active: this.is_active,
                user_agent: this.user_agent,
                ip_address: this.ip_address
            };
        }
    }

    UserSession.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        user_agent: DataTypes.TEXT,
        ip_address: DataTypes.STRING(45)
    }, {
        sequelize,
        modelName: 'UserSession',
        tableName: 'user_sessions',
        underscored: true,
        timestamps: true
    });

    return UserSession;
};