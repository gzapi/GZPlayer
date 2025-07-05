export default (sequelize, DataTypes) => {
    return sequelize.define('favorite_category_items', {
        favorite_id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        category_id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'favorite_category_items',
        timestamps: false,
        underscored: true
    });
};