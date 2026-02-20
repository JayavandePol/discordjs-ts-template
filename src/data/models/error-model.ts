import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";

export class ErrorModel extends Model<
  InferAttributes<ErrorModel>,
  InferCreationAttributes<ErrorModel>
> {
  declare id: string;
  declare timestamp: Date;
  declare severity: string;
  declare context: string;
  declare name: string | null;
  declare message: string;
  declare stack: string | null;
  declare guildId: string | null;
  declare userId: string | null;
  declare command: string | null;
  declare meta: string | null;
  declare occurrences: number;
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
      severity: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "error",
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
      guildId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      command: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      meta: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      occurrences: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      }
    },
    {
      sequelize,
      tableName: "errors",
      timestamps: false,
    }
  );

  return ErrorModel;
};
