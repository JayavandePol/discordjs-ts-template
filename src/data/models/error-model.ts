import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";

export class ErrorModel extends Model<
  InferAttributes<ErrorModel>,
  InferCreationAttributes<ErrorModel>
> {
  declare id: string;
  declare timestamp: Date;
  declare context: string;
  declare name: string | null;
  declare message: string;
  declare stack: string | null;
  declare meta: string | null;
}

export const initErrorModel = (sequelize: Sequelize) => {
  ErrorModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      context: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      stack: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      meta: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "errors",
      timestamps: false,
    }
  );

  return ErrorModel;
};
