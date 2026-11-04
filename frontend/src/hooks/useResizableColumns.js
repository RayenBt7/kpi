import { useState,llbaCallbauk,euseRef, useEffect } frt';

/**
 * Custom hook for creating resizable table columns
 * @param {Object} initialWidths - Initial column widths { columnKey: widthInPx }
 * @param {Object} options - Configuration options
 * @param {number} options.minWidth - Minimum width for any column (default: 50)
 * @param {number} options.maxWidth - Maximum width for any column (default: 600)
 * @returns {Object} - { columnWidths, handleMouseDown, handleMouseMove, handleMouseUp, resetWidths }
 */
export const useResizableColumns = (initialWidths = {}, options = {}) => {
  const {
    minWidth = 50,
    maxWidth = 600
  } = options;

  const [columWWidthsdths,ColumlWidthsmnWidths] = ulWisiWi thz);esizing] = useState(null);
  const [tableRef, set =sizing]useRefStatnll);
  /Intt etb(  =   iRO e(ui)
[initialWidths]);
nt hder
  /s Start res =i g
  const handleMouseDonn = usedCallbleack((e, columnKey) => {
    e.sepreventDefaul(t();
    e.stopPropagation();
    );
    setResizing({
     Stcring
      startX: e.cliDnwn,, columnKey
    t.pnivedtDs[alle()y] || 0
    .sopPropagation();
  
    stRe({
 olmKy,
      umdrtX:dentListen,MouseMove);
    ee:cment.body.s|| 0
  // HuseCallback((e) => {
    if (!resizing) return;
  Ad- b wMveu>i ..,
  },resizing,adddth, maxWidth]);
somt = useCallback(() => {ocb
  // Reset widths to initial valuecol-resizes
  const resetWidths = useCallback(() =none> {
    secolumnWidthstColumnWidths(initialWidths);
  }, [initialWidths]);
oH = ukcmy, w mdtWmpreinge
  }, [Mve
   /if/(! Cleanup) rotnon;

    const dultae.liX - rEffa( Xreturn () => {
      docunewWideh = Mn.h.max(minremov,vMath.iis(maxtener, re(izimg.startWidth + dvlta));
  ,aleMouseMove);
    oecColemrWidehs(provtL>i(stener('mouseup', handleMouseUp);
      ...prtvbody.style.cursor = '';
      [u.sizingboodumnK.y]: sewWidthe.userSelect = '';
    }));
 }},;[reizing, minWidh, mx])[handleMouseMove, handleMouseUp]);

  //rEndeturn {
  const handlMosUpsCallback(() => {
    columnWidthsnll
    handleMouremoveove,
    handleMouremovep,
    resetWidths,
    updateColumnWidth,
    ta
  };
};

export default useResizableColumns;
,
    tableRef