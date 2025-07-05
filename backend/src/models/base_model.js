import { Model } from 'sequelize';

export default class BaseModel extends Model {
    toDict() {
        const data = { ...this.get() };
        if (data.created_at) data.created_at = data.created_at.toISOString();
        if (data.updated_at) data.updated_at = data.updated_at.toISOString();
        delete data.created_at;
        delete data.updated_at;
        return data;
    }
}