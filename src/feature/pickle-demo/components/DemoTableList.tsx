import Pagination from '@/shared/components/common/Pagination';
import usePagination from '@/shared/hooks/usePagination';
import LanguageBadge from '@/shared/components/language/LanguageBadge';
import { usePickleServerStore } from '@/shared/store/usePickleServerStore';
import ImageCell from '@/shared/components/table/ImageCell';
import Table from '@/shared/components/table/Table';
import { deleteRow } from '@/shared/utils/excel/deleteRow';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BLUE_BADGE_STYLE } from '@/constants/badgeStyles';

interface DemoTableListProps {
  data: any[];
  columnDefs: { key: string; label: string; width: string }[];
  selectedLang: string;
  detailPath?: string;
  editPath: string;
  tableName: string;
  onDeleted?: () => void;
}

const DemoTableList: React.FC<DemoTableListProps> = ({
  data,
  columnDefs,
  selectedLang,
  detailPath,
  editPath,
  tableName,
  onDeleted,
}) => {
  const navigate = useNavigate();
  const { isServerLoggedIn } = usePickleServerStore();
  const accessToken = isServerLoggedIn('web-demo');
  const { page, setPage, totalPages, pagedData } = usePagination(data);

  // 언어 변경 시 1페이지로 이동
  useEffect(() => {
    setPage(1);
  }, [selectedLang, setPage]);

  const handleDelete = async (id: number) => {
    if (!accessToken) {
      toast.warn('웹데모 로그인이 필요합니다.');
      return;
    }

    const confirmed = window.confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    const result = await deleteRow(tableName, id);

    if (result.success) {
      if (onDeleted) onDeleted();
      return;
    }

    if (result.isRlsError) {
      alert(
        `삭제 실패: ${result.message}\n\nSupabase RLS DELETE 정책이 필요합니다. ${tableName} 테이블에 authenticated 대상 DELETE policy를 추가해주세요.`
      );
      return;
    }

    alert('삭제 실패: ' + result.message);
  };

  const handleRowClick = (row: any) => {
    if (!detailPath) return;
    navigate(`${detailPath}/${row.id}?lang=${selectedLang}`);
  };

  const getValueByPath = (obj: any, path: string): any => {
    if (!path.includes('.')) return obj?.[path];

    return path.split('.').reduce((acc: any, part: string) => {
      if (acc == null) return undefined;

      // 관계 데이터가 배열로 내려오면 각 항목의 값을 추출합니다.
      if (Array.isArray(acc)) {
        return acc.map((item) => item?.[part]).filter((item) => item != null);
      }

      return acc[part];
    }, obj);
  };

  const renderCell = (key: string, row: any) => {
    if (key === 'img_url') {
      if (!row.img_url) return null;
      return <ImageCell url={row.img_url} />;
    }

    if (key === 'language') {
      return <LanguageBadge languages={row.language} />;
    }

    if (key === 'actions') {
      return (
        <div className='flex gap-2'>
          <button
            className={`px-3 py-1 rounded ${BLUE_BADGE_STYLE} hover:bg-blue-200 transition text-sm`}
            onClick={(e) => {
              e.stopPropagation();
              if (!accessToken) {
                toast.warn('웹데모 로그인이 필요합니다.');
                return;
              }
              navigate(`${editPath}/${row.id}?lang=${selectedLang}`);
            }}
          >
            편집
          </button>

          <button
            className='px-3 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition text-sm'
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.id);
            }}
          >
            삭제
          </button>
        </div>
      );
    }

    const value = getValueByPath(row, key);

    // boolean 타입 처리
    if (typeof value === 'boolean') {
      if (key === 'is_active' || key === 'is_searchable') {
        return value ? (
          <span className='inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200'>
            Active
          </span>
        ) : (
          <span className='inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border bg-red-100 text-red-700 border-red-200'>
            Inactive
          </span>
        );
      }
      return value ? 'O' : 'X';
    }

    return Array.isArray(value) ? value.join(', ') : value;
  };

  const columns = columnDefs.map(({ key, label }) => ({ key, label }));
  const gridCols = columnDefs.map(({ width }) => width).join(' ');

  return (
    <>
      <Table
        columns={columns}
        data={pagedData}
        gridTemplateColumns={gridCols}
        renderCell={renderCell}
        onRowClick={detailPath ? handleRowClick : undefined}
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
};

export default DemoTableList;
