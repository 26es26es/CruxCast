"""add gym map position

Revision ID: 29839afd1997
Revises: 375989c1ea42
Create Date: 2026-10-15 14:48:57.423681
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '29839afd1997'
down_revision: str | None = '375989c1ea42'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The grade scale moved from coarse steps below 6A ("4+", "5") to TopLogger's
# full Font scale ("4B", "5A+"); map old values to their closest new grade.
OLD_TO_NEW_GRADES = {"3": "3A", "4": "4A", "4+": "4C", "5": "5A", "5+": "5C"}


def upgrade() -> None:
    op.add_column('cruxes', sa.Column('map_x', sa.Float(), nullable=True))
    op.add_column('cruxes', sa.Column('map_y', sa.Float(), nullable=True))
    op.add_column('cruxes', sa.Column('toplogger_climb_id', sa.String(length=40), nullable=True))
    for column in ("gym_grade", "personal_grade"):
        for old, new in OLD_TO_NEW_GRADES.items():
            op.execute(
                sa.text(f"UPDATE cruxes SET {column} = :new WHERE {column} = :old").bindparams(
                    old=old, new=new
                )
            )


def downgrade() -> None:
    op.drop_column('cruxes', 'toplogger_climb_id')
    op.drop_column('cruxes', 'map_y')
    op.drop_column('cruxes', 'map_x')
